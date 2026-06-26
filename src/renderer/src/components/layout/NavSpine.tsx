import { Link, useRouterState } from '@tanstack/react-router'
import {
  BookOutlined,
  CloudSyncOutlined,
  DatabaseOutlined,
  SearchOutlined,
  SettingOutlined
} from '@ant-design/icons'

const NAV_ITEMS = [
  { to: '/sources', label: '文档源', icon: DatabaseOutlined, spine: '#0f766e' },
  { to: '/browse', label: '浏览', icon: BookOutlined, spine: '#1d4ed8' },
  { to: '/search', label: '搜索', icon: SearchOutlined, spine: '#7c3aed' },
  { to: '/sync', label: '同步', icon: CloudSyncOutlined, spine: '#ca8a04' },
  { to: '/settings', label: '设置', icon: SettingOutlined, spine: '#6b7280' }
] as const

export function NavSpine(): React.JSX.Element {
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  return (
    <nav className="flex flex-col gap-1 px-3 py-6" aria-label="主导航">
      <div className="px-3 mb-6">
        <p className="font-display text-xl text-archive-ink font-semibold tracking-tight m-0">
          DocHub
        </p>
        <p className="archive-label mt-1 mb-0">本地文档镜像</p>
      </div>

      {NAV_ITEMS.map((item) => {
        const active = pathname.startsWith(item.to)
        const Icon = item.icon
        return (
          <Link
            key={item.to}
            to={item.to}
            className={[
              'group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors no-underline',
              active
                ? 'bg-white shadow-sm text-archive-teal'
                : 'text-archive-muted hover:bg-archive-shelf/60 hover:text-archive-ink'
            ].join(' ')}
          >
            <span
              className="archive-spine h-8 transition-all group-hover:h-9"
              style={{ backgroundColor: item.spine, opacity: active ? 1 : 0.45 }}
              aria-hidden
            />
            <Icon className="text-base" />
            <span className="font-body text-sm font-medium">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
