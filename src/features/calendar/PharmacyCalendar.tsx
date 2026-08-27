import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import listPlugin from '@fullcalendar/list'
import multiMonthPlugin from '@fullcalendar/multimonth'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import { Bell, CheckCircle2, Clock, ShieldAlert } from 'lucide-react'
import { calendarItems, personnel, pharmacyLocations } from '../../data/demo'

const eventClassNames = {
  shift: 'event-shift',
  note: 'event-note',
  task: 'event-task',
}

export function PharmacyCalendar() {
  const events = calendarItems.map((item) => ({
    id: item.id,
    title: item.title,
    start: item.startsAt,
    end: item.endsAt,
    className: eventClassNames[item.kind],
    extendedProps: item,
  }))

  return (
    <section className="calendar-layout" aria-label="Pharmacy operations calendar">
      <div className="calendar-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Pharmacy schedule</p>
            <h1>Central Pharmacy operations</h1>
          </div>
          <div className="status-pill">
            <CheckCircle2 size={16} aria-hidden="true" />
            RLS first architecture
          </div>
        </div>

        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, multiMonthPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'timeGridWeek,dayGridMonth,multiMonthYear,listWeek',
          }}
          nowIndicator
          editable
          selectable
          height="auto"
          events={events}
        />
      </div>

      <aside className="operations-panel" aria-label="Operations summary">
        <div>
          <p className="eyebrow">Today</p>
          <h2>Coverage snapshot</h2>
        </div>

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
      </aside>
    </section>
  )
}
