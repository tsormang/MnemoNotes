---
name: add-shell-modal
description: Adds calendar-shell modal or panel features in MnemoNotes (People, Search, Create, Notifications, Security) using the shared Modal component and top app bar icons. Use when adding UI behind icon actions, popups, drawers, or keeping the calendar full-bleed without new sidebar pages.
---

# Add Shell Modal

## UI rules

- Calendar stays the only full viewport in `/app`
- New secondary features open via `Modal` (`src/components/Modal.tsx`)
- Top bar: brand left; icon-only actions right (`lucide-react`)
- Variants: `modal` (centered) or `panel` (side); use `wide` sparingly

## Workflow

```
Progress:
- [ ] 1. Extend ShellModal union in App.tsx
- [ ] 2. Add app-bar icon button
- [ ] 3. Build feature content
- [ ] 4. Style with existing CSS variables
- [ ] 5. Check mobile
```

### 1–2. Wire shell

In `src/App.tsx`:

- Extend `ShellModal` type with the new key
- Add `icon-ghost` button with `aria-label`
- Render `<Modal open={...} onClose={...} title="..." variant="...">`

### 3. Feature content

- Prefer `src/features/<area>/` component (e.g. `PeopleScreen`)
- Forms: RHF + Zod; reuse `src/lib/validation.ts` patterns
- Keep content focused — one job per modal

### 4. Styles

- Tokens in `src/index.css`: `--color-*`, `--radius-*`, `--shadow-*`
- App/modal layout classes in `src/App.css`
- No Tailwind / new UI kit

### 5. Mobile

- Ensure modal/panel fits small viewports
- Icon targets remain tappable; no permanent side nav

## Example pattern

```tsx
<button className="icon-ghost" type="button" aria-label="People" onClick={() => setOpenModal('people')}>
  <Users size={19} aria-hidden="true" />
</button>

<Modal open={openModal === 'people'} onClose={closeModal} title="People" variant="panel" wide>
  <PeopleScreen />
</Modal>
```
