import {
  type LightbulbIcon as LucideProps,
  MessageSquare,
  User,
  LogOut,
  Loader2,
  ChevronLeft,
  ChevronRight,
  BarChart,
  PieChart,
  LineChart,
  Send,
  Plus,
  Bookmark,
  Clock,
  Settings,
  Menu,
  X,
} from "lucide-react"

export type IconProps = LucideProps

export const Icons = {
  logo: ({ ...props }: IconProps) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      width="40" height="40"
      style={{ maxWidth: '100%', height: 'auto', display: 'block' }}
      {...props}
    >
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  ),
  chat: MessageSquare,
  user: User,
  logout: LogOut,
  spinner: Loader2,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  barChart: BarChart,
  pieChart: PieChart,
  lineChart: LineChart,
  send: Send,
  add: Plus,
  bookmark: Bookmark,
  history: Clock,
  settings: Settings,
  menu: Menu,
  close: X,
}

