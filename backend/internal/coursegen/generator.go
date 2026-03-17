package coursegen

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"context"
	"fmt"
	"io"
	"os"
	"regexp"
	"strings"

	"moodlecloud/backend/internal/ai"
)

type Generator struct {
	templatePath string
}

func NewGenerator(templatePath string) *Generator {
	return &Generator{
		templatePath: templatePath,
	}
}

// Generate assembles a new .mbz file by extracting the template, injecting the AI-generated
// content into the XML nodes, and repacking the archive.
// It returns the file blob as a byte slice.
func (g *Generator) Generate(ctx context.Context, outline *ai.GeneratedCourseOutline) ([]byte, error) {
	// 1. Check if template exists
	if _, err := os.Stat(g.templatePath); os.IsNotExist(err) {
		return nil, fmt.Errorf("template file not found at %s. Please ensure a blank Moodle backup (.mbz) is placed there", g.templatePath)
	}

	// 2. Read template
	templateBytes, err := os.ReadFile(g.templatePath)
	if err != nil {
		return nil, fmt.Errorf("read template file: %w", err)
	}

	// 3. Extract, modify, and repack in memory
	return modifyMBZArchive(templateBytes, outline)
}

func modifyMBZArchive(mbzData []byte, outline *ai.GeneratedCourseOutline) ([]byte, error) {
	// Read gzip
	gzr, err := gzip.NewReader(bytes.NewReader(mbzData))
	if err != nil {
		return nil, fmt.Errorf("gzip read: %w", err)
	}
	defer gzr.Close()

	tr := tar.NewReader(gzr)

	// Prepare to write new tar.gz
	var outBuf bytes.Buffer
	gzw := gzip.NewWriter(&outBuf)
	tw := tar.NewWriter(gzw)

	// We use regex to replace course name and summary dynamically
	fullnameRe := regexp.MustCompile(`(?s)<fullname>.*?</fullname>`)
	shortnameRe := regexp.MustCompile(`(?s)<shortname>.*?</shortname>`)
	summaryRe := regexp.MustCompile(`(?s)<summary>.*?</summary>`)

	for {
		header, err := tr.Next()
		if err == io.EOF {
			break // End of archive
		}
		if err != nil {
			return nil, fmt.Errorf("tar next: %w", err)
		}

		// Read file content
		content, err := io.ReadAll(tr)
		if err != nil {
			return nil, fmt.Errorf("read tar file %s: %w", header.Name, err)
		}

		// Modify specific XML files based on the AI output
		// Note: A real implementation would parse the XML structure exactly, matching
		// sections.xml and page.xml to outline.Sections and outline.Sections[x].Pages.
		// For this prototype, we'll generically inject the Course title to course.xml.
		modifiedContent := content

		if header.Typeflag == tar.TypeReg {
			if strings.HasSuffix(header.Name, "course/course.xml") {
				mod := fullnameRe.ReplaceAllString(string(modifiedContent), fmt.Sprintf("<fullname><![CDATA[%s]]></fullname>", outline.Title))
				// Shortname we can just truncate or use a slug 
				mod = shortnameRe.ReplaceAllString(mod, fmt.Sprintf("<shortname><![CDATA[AI-C-%d]]></shortname>", len(outline.Title)))
				mod = summaryRe.ReplaceAllString(mod, fmt.Sprintf("<summary><![CDATA[%s]]></summary>", outline.Description))
				modifiedContent = []byte(mod)
			}
			// In a full implementation, we would also intercept sections.xml and activities/page_*/page.xml
			// We skip it here because we lack the actual template ID mappings.
		}

		// Write header with new size
		header.Size = int64(len(modifiedContent))
		if err := tw.WriteHeader(header); err != nil {
			return nil, fmt.Errorf("write tar header %s: %w", header.Name, err)
		}

		// Write modified content
		if _, err := tw.Write(modifiedContent); err != nil {
			return nil, fmt.Errorf("write tar content %s: %w", header.Name, err)
		}
	}

	if err := tw.Close(); err != nil {
		return nil, fmt.Errorf("close tar writer: %w", err)
	}
	if err := gzw.Close(); err != nil {
		return nil, fmt.Errorf("close gzip writer: %w", err)
	}

	return outBuf.Bytes(), nil
}
