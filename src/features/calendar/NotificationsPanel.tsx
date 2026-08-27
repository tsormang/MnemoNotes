import { Bell, Clock, ShieldAlert } from 'lucide-react'
import { calendarItems, personnel, pharmacyLocations } from '../../data/demo'

export function NotificationsPanel() {
  return (
    <div className="notifications-panel">
      <div className="metric-grid">
        <div className="metric">
          <span>Locations</span>
          <strong>{pharmacyLocations.length}</strong>
        </div>
        <div className="metric">
          <span>Personnel</span>
          <strong>{personnel.length}</strong>
        </div>
        <div className="metric">
          <span>Alerts</span>
          <strong>3</strong>
        </div>
        <div className="metric">
          <span>Acks due</span>
          <strong>2</strong>
        </div>
      </div>

      <div className="timeline-list">
        <p className="eyebrow">Due today</p>
        {calendarItems.map((item) => (
          <article className="timeline-item" key={item.id}>
            <div className={`timeline-icon ${item.kind}`}>
              {item.requiresAcknowledgement ? (
                <ShieldAlert size={18} aria-hidden="true" />
              ) : (
                <Clock size={18} aria-hidden="true" />
              )}
            </div>
            <div>
              <h3>{item.title}</h3>
              <p>
                {item.notificationOffsets.length} notification rules
                {item.requiresAcknowledgement ? ' with acknowledgement' : ''}
              </p>
            </div>
          </article>
        ))}
      </div>

      <div className="notification-card">
        <Bell size={20} aria-hidden="true" />
        <div>
          <h3>Notification engine</h3>
          <p>Rules create durable jobs for before, during, and after shift windows.</p>
        </div>
      </div>
    </div>
  )
}
