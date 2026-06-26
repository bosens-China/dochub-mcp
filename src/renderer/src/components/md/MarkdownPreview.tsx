import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import '@renderer/assets/markdown.css'

interface MarkdownPreviewProps {
  content: string
  /** 嵌入弹窗等场景时可覆盖默认布局类名 */
  className?: string
}

const defaultClassName =
  'markdown-preview prose prose-stone max-w-none font-body px-6 py-4 overflow-y-auto flex-1 min-h-0'

export function MarkdownPreview({
  content,
  className = defaultClassName
}: MarkdownPreviewProps): React.JSX.Element {
  return (
    <article className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
        {content}
      </ReactMarkdown>
    </article>
  )
}
