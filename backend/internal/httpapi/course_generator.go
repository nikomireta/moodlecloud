package httpapi

import (
	"fmt"
	"net/http"
	"moodlecloud/backend/internal/ai"
)

type generateCourseRequest struct {
	Prompt string `json:"prompt"`
}

func (s *Server) handleGenerateOutline(w http.ResponseWriter, r *http.Request) {
	var req generateCourseRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	if req.Prompt == "" {
		writeError(w, http.StatusBadRequest, "Prompt is required")
		return
	}

	outline, err := s.aiClient.GenerateCourseOutline(r.Context(), req.Prompt)
	if err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to generate outline: %v", err))
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{"course": outline})
}

func (s *Server) handleExportMBZ(w http.ResponseWriter, r *http.Request) {
	var outline ai.GeneratedCourseOutline
	if err := decodeJSON(r, &outline); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	mbzData, err := s.courseGen.Generate(r.Context(), &outline)
	if err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to assemble course backup: %v", err))
		return
	}

	w.Header().Set("Content-Type", "application/gzip")
	w.Header().Set("Content-Disposition", `attachment; filename="ai-generated-course.mbz"`)
	w.Header().Set("Content-Length", fmt.Sprintf("%d", len(mbzData)))
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(mbzData)
}
