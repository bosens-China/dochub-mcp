import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import '@renderer/assets/markdown.css'

interface MarkdownPreviewProps {
  content: string
}

export function MarkdownPreview({ content }: MarkdownPreviewProps): React.JSX.Element {
  return (
    <article className="markdown-preview prose prose-stone max-w-none font-body px-6 py-4 overflow-y-auto flex-1 min-h-0">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
        {content}
      </ReactMarkdown>
    </article>
  )
}
