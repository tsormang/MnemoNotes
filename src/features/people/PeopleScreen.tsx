import { MailPlus, ShieldCheck } from 'lucide-react'
import { personnel } from '../../data/demo'
import { roleLabels } from '../../lib/access-control'

export function PeopleScreen() {
  return (
    <section className="content-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Users and personnel</p>
          <h1>Pharmacy team access</h1>
        </div>
        <button className="icon-button" type="button">
          <MailPlus size={18} aria-hidden="true" />
          Invite personnel
        </button>
      </div>

      <div className="table-shell">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Title</th>
              <th>Skills</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {personnel.map((person) => (
              <tr key={person.id}>
                <td>{person.fullName}</td>
                <td>{roleLabels[person.role]}</td>
                <td>{person.title}</td>
                <td>{person.skills.join(', ')}</td>
                <td>
                  <span className={`status ${person.status}`}>
                    <ShieldCheck size={14} aria-hidden="true" />
                    {person.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
