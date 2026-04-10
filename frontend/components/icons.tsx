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

