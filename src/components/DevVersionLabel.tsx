import { appVersion, schemaVersion } from '../lib/build-info'

export function DevVersionLabel() {
  if (!import.meta.env.DEV) {
    return null
  }

  return (
    <span
      className="brand-dev-version"
      title={`App ${appVersion} · Schema ${schemaVersion}`}
    >
      v{appVersion} · schema {schemaVersion}
    </span>
  )
}
