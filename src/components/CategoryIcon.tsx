import { categoryIcons } from '../lib/categoryIcons'

export default function CategoryIcon({ name, className = 'w-4 h-4 shrink-0' }: { name?: string; className?: string }) {
  const Icon = (name && Object.prototype.hasOwnProperty.call(categoryIcons, name) ? categoryIcons[name] : undefined) || categoryIcons.tag
  return <Icon className={className} aria-hidden="true" />
}
