"""Document upload and management, scoped to the caller's session."""

import asyncio
import logging
import os
from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from ..config import settings
from ..errors import UserFacingError, internal_error
from ..rate_limit import upload_rate_limited
from ..services import services
from ..sessions import require_session_id

logger = logging.getLogger(__name__)
router = APIRouter(tags=["documents"])


def too_large_message() -> str:
    return f"File is too large. The maximum size is {settings.max_upload_size // (1024 * 1024)} MB."


async def _read_pdf_upload(file: UploadFile) -> bytes:
    """Read an upload in chunks, enforcing the size limit and checking it really is a PDF"""
    chunks, size = [], 0
    while chunk := await file.read(1024 * 1024):
        size += len(chunk)
        if size > settings.max_upload_size:
            raise UserFacingError(too_large_message(), status_code=413)
        chunks.append(chunk)
    content = b"".join(chunks)
    if not content.startswith(b"%PDF-"):
        raise UserFacingError("This file isn't a valid PDF.", status_code=415)
    return content


@router.post("/upload")
async def upload_document(file: UploadFile = File(...), session_id: str = Depends(upload_rate_limited)):
    """Upload and process a document into the caller's session"""
    try:
        # Keep only the base name: it is shown in the UI and used as the document key
        filename = os.path.basename((file.filename or "").replace("\\", "/")).strip()[:200]
        if not filename.lower().endswith(".pdf"):
            raise UserFacingError("Only PDF files are supported", status_code=415)

        store = services.store(session_id)
        existing = store.document_summaries()
        if filename not in existing and len(existing) >= settings.max_documents_per_session:
            raise UserFacingError(
                f"You can have up to {settings.max_documents_per_session} documents. Delete one to upload another.",
                status_code=409,
            )

        content = await _read_pdf_upload(file)
        logger.info(f"Processing document: {filename} ({len(content)} bytes)")

        # PDF parsing is CPU-bound and embedding is a blocking HTTP call: keep both off the event loop
        documents = await asyncio.to_thread(services.document_processor.process_document, filename, content)
        if len(documents) > settings.max_chunks_per_document:
            raise UserFacingError("This document has too much text to process. Try splitting it into smaller files.", status_code=413)
        uploaded_at = datetime.now().isoformat()
        for doc in documents:
            doc.metadata["uploaded_at"] = uploaded_at

        # Re-uploading a file replaces it instead of duplicating its chunks
        if filename in existing:
            await asyncio.to_thread(store.delete_document, filename)
        await asyncio.to_thread(store.add_documents, documents)
        logger.info(f"Document {filename} processed and added to vector store successfully")

        if services.analytics:
            services.analytics.track_session(
                user_id=session_id,
                session_type="upload",
                document_name=filename,
                metadata={"file_size": len(content), "chunks_count": len(documents), "file_type": "pdf"},
            )

        return {
            "message": "Document uploaded and processed successfully",
            "details": {
                "status": "success",
                "file_name": filename,
                "chunks_created": len(documents),
                "total_documents": len(store.get_all_documents()),
            },
        }
    except HTTPException:
        raise
    except Exception:
        raise internal_error("Processing the document")


@router.get("/documents")
async def list_documents(session_id: str = Depends(require_session_id)):
    """List the caller's processed documents"""
    try:
        store = services.store(session_id)
        doc_list = [
            {
                "filename": summary["filename"],
                "file_size": f"{(summary['file_size'] or 0) / (1024 * 1024):.1f}MB",
                "chunks_count": summary["chunks_count"],
                "uploaded_at": summary["uploaded_at"],
            }
            for summary in store.document_summaries().values()
        ]
        return {"documents": doc_list, "total": len(doc_list), "total_chunks": len(store.get_all_documents())}
    except Exception:
        raise internal_error("Listing documents")


@router.delete("/documents/{filename}")
async def delete_document(filename: str, session_id: str = Depends(require_session_id)):
    """Delete a specific document from the caller's session"""
    try:
        await asyncio.to_thread(services.store(session_id).delete_document, filename)
        logger.info(f"Document {filename} deleted from session store")
        return {"message": f"Document '{filename}' deleted successfully", "timestamp": datetime.now().isoformat(), "status": "success"}
    except Exception:
        raise internal_error("Deleting the document")


@router.delete("/clear-documents")
async def clear_documents(session_id: str = Depends(require_session_id)):
    """Clear all documents from the caller's session"""
    try:
        services.session_stores.delete(session_id)
        logger.info("Session documents cleared successfully")
        return {"message": "All documents cleared successfully", "timestamp": datetime.now().isoformat(), "status": "success"}
    except Exception:
        raise internal_error("Clearing documents")


@router.get("/current-session-documents")
async def get_current_session_documents(session_id: str = Depends(require_session_id)):
    """Get documents in the caller's session (persisted across server restarts)"""
    try:
        details = services.store(session_id).document_summaries()
        return {"documents": list(details.keys()), "total": len(details), "details": details}
    except Exception:
        raise internal_error("Loading session documents")


@router.get("/vector-store-info")
async def get_vector_store_info(session_id: str = Depends(require_session_id)):
    """Get information about the caller's vector store"""
    try:
        store = services.store(session_id)
        documents = store.get_all_documents()
        summaries = store.document_summaries()
        return {
            "has_documents": store.has_documents(),
            "total_documents": len(documents),
            "unique_sources": len(summaries),
            "total_chunks": len(documents),
            "current_session_documents": list(summaries.keys()),
        }
    except Exception:
        raise internal_error("Loading vector store info")
