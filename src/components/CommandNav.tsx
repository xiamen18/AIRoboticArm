import { ChevronRight, Search } from 'lucide-react'
import { COMMAND_GROUPS, COMMANDS } from '../protocol/commands'

interface CommandNavProps {
  selected: string
  onSelect(cmd: string): void
}

export function CommandNav({ selected, onSelect }: CommandNavProps) {
  return (
    <aside className="command-nav panel">
      <div className="panel-heading">
        <div><span className="section-index">01</span><h2>命令矩阵</h2></div>
        <span className="count-chip">{COMMANDS.length} CMD</span>
      </div>
      <div className="nav-search"><Search size={14} /><span>按设备模块分组</span></div>
      <nav aria-label="协议命令">
        {COMMAND_GROUPS.map((group) => (
          <section className="command-group" key={group}>
            <h3>{group}</h3>
            {COMMANDS.filter((command) => command.group === group).map((command) => (
              <button
                type="button"
                key={command.cmd}
                className={selected === command.cmd ? 'command-item active' : 'command-item'}
                onClick={() => onSelect(command.cmd)}
              >
                <span className={`kind-dot kind-${command.kind}`} />
                <span><strong>{command.name}</strong><code>{command.cmd}</code></span>
                <ChevronRight size={14} />
              </button>
            ))}
          </section>
        ))}
      </nav>
    </aside>
  )
}
