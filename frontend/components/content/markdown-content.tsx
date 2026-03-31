import Link from "next/link"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import { cn } from "@/lib/utils"

type MarkdownContentProps = {
  content: string
  className?: string
}

export function MarkdownContent({ content, className }: MarkdownContentProps) {
  return (
    <div className={cn("max-w-none text-foreground", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="mb-5 text-3xl font-bold tracking-tight">{children}</h1>,
          h2: ({ children }) => <h2 className="mt-10 mb-4 text-2xl font-bold tracking-tight">{children}</h2>,
          h3: ({ children }) => <h3 className="mt-8 mb-3 text-xl font-semibold tracking-tight">{children}</h3>,
          p: ({ children }) => <p className="mb-4 leading-7 text-muted-foreground">{children}</p>,
          ul: ({ children }) => <ul className="mb-4 list-disc space-y-2 pl-6 text-muted-foreground">{children}</ul>,
          ol: ({ children }) => <ol className="mb-4 list-decimal space-y-2 pl-6 text-muted-foreground">{children}</ol>,
          li: ({ children }) => <li className="leading-7">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
          blockquote: ({ children }) => (
            <blockquote className="mb-4 border-l-2 border-border pl-4 italic text-muted-foreground">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-8 border-border" />,
          code: ({ children, className: codeClassName }) => {
            const isInline = !codeClassName
            if (isInline) {
              return <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm text-foreground">{children}</code>
            }
            return (
              <code className="block overflow-x-auto rounded-lg bg-muted px-4 py-3 font-mono text-sm text-foreground">
                {children}
              </code>
            )
          },
          pre: ({ children }) => <pre className="mb-4 overflow-x-auto">{children}</pre>,
          a: ({ href, children }) => {
            if (!href) {
              return <span>{children}</span>
            }
            if (href.startsWith("/")) {
              return (
                <Link href={href} className="font-medium text-foreground underline underline-offset-4 hover:text-foreground/80">
                  {children}
                </Link>
              )
            }
            return (
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-foreground underline underline-offset-4 hover:text-foreground/80"
              >
                {children}
              </a>
            )
          },
          table: ({ children }) => (
            <div className="mb-6 overflow-x-auto rounded-lg border border-border">
              <table className="w-full border-collapse text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-muted/50">{children}</thead>,
          tbody: ({ children }) => <tbody>{children}</tbody>,
          tr: ({ children }) => <tr className="border-t border-border">{children}</tr>,
          th: ({ children }) => <th className="px-4 py-3 text-left font-semibold text-foreground">{children}</th>,
          td: ({ children }) => <td className="px-4 py-3 align-top text-muted-foreground">{children}</td>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
