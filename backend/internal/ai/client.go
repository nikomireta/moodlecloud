package ai

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"

	"github.com/sashabaranov/go-openai"
)

type Client struct {
	logger *slog.Logger
	api    *openai.Client
	model  string
}

func NewClient(logger *slog.Logger, apiKey, baseURL, model string) *Client {
	config := openai.DefaultConfig(apiKey)
	if baseURL != "" {
		config.BaseURL = baseURL
	}
	client := openai.NewClientWithConfig(config)
	if model == "" {
		model = openai.GPT4o
	}

	return &Client{
		logger: logger.With("component", "ai_client", "model", model),
		api:    client,
		model:  model,
	}
}

type GeneratedCourseOutline struct {
	Title       string                   `json:"title"`
	Description string                   `json:"description"`
	Sections    []GeneratedCourseSection `json:"sections"`
}

type GeneratedCourseSection struct {
	Title   string                `json:"title"`
	Summary string                `json:"summary"`
	Pages   []GeneratedCoursePage `json:"pages"`
}

type GeneratedCoursePage struct {
	Title   string `json:"title"`
	Content string `json:"content"`
}

const systemPrompt = `You are an expert instructional designer and Moodle course creator.
The user will provide a topic or prompt for a new course.
Your task is to generate a comprehensive, highly detailed course outline that can be imported to Moodle.
You must return the result as a raw JSON string matching this exact structure:
{
  "title": "Course Title",
  "description": "Short HTML description of the course.",
  "sections": [
    {
      "title": "Section Title (e.g., Topic 1: Introduction)",
      "summary": "Short HTML summary of the section.",
      "pages": [
        {
          "title": "Page Title (e.g., What is X?)",
          "content": "Comprehensive HTML content for this page. Use paragraphs, lists, bold text, etc., but ensure it's valid HTML."
        }
      ]
    }
  ]
}
Make sure to generate at least 3 sections, with at least 2 pages each.
The HTML content should be well-formatted, engaging, and in Indonesian (Bahasa Indonesia) unless the user specifies otherwise.`

// GenerateCourseOutline calls the LLM to generate a course structure and content based on a prompt.
func (c *Client) GenerateCourseOutline(ctx context.Context, prompt string) (*GeneratedCourseOutline, error) {
	c.logger.Info("generating course outline from LLM", "prompt", prompt)

	req := openai.ChatCompletionRequest{
		Model: c.model,
		Messages: []openai.ChatCompletionMessage{
			{
				Role:    openai.ChatMessageRoleSystem,
				Content: systemPrompt,
			},
			{
				Role:    openai.ChatMessageRoleUser,
				Content: prompt,
			},
		},
		ResponseFormat: &openai.ChatCompletionResponseFormat{
			Type: openai.ChatCompletionResponseFormatTypeJSONObject,
		},
		Temperature: 0.7,
	}

	resp, err := c.api.CreateChatCompletion(ctx, req)
	if err != nil {
		c.logger.Error("failed to call completion API", "error", err)
		return nil, fmt.Errorf("create chat completion: %w", err)
	}

	if len(resp.Choices) == 0 {
		return nil, fmt.Errorf("no choices returned from LLM")
	}

	content := strings.TrimSpace(resp.Choices[0].Message.Content)
	c.logger.Debug("received LLM response", "content", content)

	// Some models ignore ResponseFormat JSON and wrap in markdown
	if strings.HasPrefix(content, "```json") {
		content = strings.TrimPrefix(content, "```json")
		content = strings.TrimSuffix(strings.TrimSpace(content), "```")
	} else if strings.HasPrefix(content, "```") {
		content = strings.TrimPrefix(content, "```")
		content = strings.TrimSuffix(strings.TrimSpace(content), "```")
	}

	var outline GeneratedCourseOutline
	if err := json.Unmarshal([]byte(content), &outline); err != nil {
		c.logger.Error("failed to unmarshal JSON response", "error", err, "content", content)
		return nil, fmt.Errorf("parse JSON from LLM: %w", err)
	}

	return &outline, nil
}
