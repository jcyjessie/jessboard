# Jessboard Visual Reference

Jessboard's next visual refresh follows [Tasks Manager](https://dribbble.com/shots/21516421-Tasks-Manager) and [Task Manager Dashboard UI by Design Laboratory](https://dribbble.com/shots/23648549-Task-Manager-Dashboard-UI). The public references are concept screens. Their visual system is the source of truth for composition, contrast, colour roles, density, and motion restraint; Jessboard keeps its own content and interactions.

## Visual Rules

- A pale calendar surface sits inside a matte near-black application chassis.
- Strongly coloured cards are the exception, used to separate meaningful work states at a glance.
- A three-zone desktop layout gives the calendar the largest area, keeps urgent work visible at the right, and reserves a narrow utility rail for global actions.
- Large numerals, short titles, and compact metadata establish hierarchy. Decorative text must never replace readable content.
- Black or white text is selected for contrast against each signal card. Colour is never the only indication of task state.
- The selected work view is a white, week-based timeline. The dark right rail is a continuous priority queue rather than a collection of unrelated widgets.
- Compact black toolbars define a separate interaction layer: top controls switch views and time range; the bottom bar controls card colour, attachments, reminders, archive, and deletion.

## Design Tokens

These tokens are high-fidelity values estimated from the public reference image. They are not claimed to be the original unpublished Figma values.

```css
:root {
  --ref-canvas: #dedee5;
  --ref-chassis: #17181c;
  --ref-chassis-raised: #222329;
  --ref-surface: #fbfbfd;
  --ref-surface-muted: #f0f0f4;
  --ref-ink: #16171b;
  --ref-muted: #75777f;
  --ref-line: #e5e5eb;
  --ref-yellow: #f5ef73;
  --ref-coral: #fb9380;
  --ref-violet: #b68aff;
  --ref-cyan: #73ddec;
  --ref-green: #70eda0;
  --ref-danger: #ff6c62;
  --ref-focus: #caee63;
  --ref-on-dark: #f8f8fb;
  --ref-on-light: #131419;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;

  --radius-control: 999px;
  --radius-card: 18px;
  --radius-panel: 24px;
  --radius-shell: 30px;
  --border-subtle: 1px solid var(--ref-line);
  --shadow-shell: 0 22px 55px rgba(15, 16, 20, 0.2);
  --shadow-floating: 0 10px 24px rgba(15, 16, 20, 0.16);
}
```

## Spacing And Layout

Desktop composition uses an 8px rhythm. The application shell is inset by 72px to 80px from a wide viewport, has a 5px dark frame, and uses a 30px outer radius. Internal page padding is 24px. The main work area has a 2:1 split between calendar and urgent-work rail, with 12px gaps. The utility rail is fixed at 64px wide. The analytics row uses three equal panels, 12px apart, below the main area. The calendar header holds five days in equal columns; the current day has dark numerals and a fine vertical time marker, while the other days use muted numerals.

Task cards use 16px to 20px internal padding. Controls are 32px high in dense toolbars and 40px high when they are the primary action. Avatars are 24px. Small metadata is separated from the title by 8px, while major content sections use 24px to 32px separation.

On small screens, the utility rail becomes a bottom action bar. Calendar, urgent work, and analytics become vertical sections, each retaining a minimum 16px edge inset and 12px gap.

## Typography

The reference relies on a rounded, modern sans-serif rather than Jessboard's existing editorial serif pairing. Use `Manrope` for Latin text and `Noto Sans SC` for Chinese UI text when this direction is implemented. Use 28px to 32px for primary page titles, 20px for panel titles, 16px for task titles, 12px for body metadata, and 10px to 11px for labels. Keep letter spacing at `0` and use tabular numerals for times and metrics.

## Interaction Patterns

- **View controls:** a segmented Card / Block / Table switch is centred in the calendar toolbar. Only the active segment uses the white fill; the group remains a black capsule.
- **Range controls:** the week range is a 32px outlined pill. Secondary information, such as last update and owner, sits beside it in compact plain text.
- **Timeline:** cards align to the day and time grid. A selected card exposes a small overflow menu with clear reminder, archive, and delete actions.
- **Task rail:** each urgent card displays time first, then title, people, status, and progress. A circular arrow icon is the only entry action; cards do not need a separate text button.
- **Bottom bar:** the timeline action bar is visually attached to the calendar bottom edge. It provides colour choices and item actions without obscuring scheduled work.
- **Analytics:** dark statistic panels are calm secondary information. Their charts use one highlighted series and subdued gray comparison values.

## Colour Semantics

| Token | Meaning | Typical use |
| --- | --- | --- |
| `--ref-yellow` | Current focus | selected day, primary action, active utility state |
| `--ref-coral` | Urgent work | overdue tasks, immediate attention |
| `--ref-violet` | Planned collaboration | meetings and shared reviews |
| `--ref-cyan` | Reporting | analysis, summaries, and system output |
| `--ref-green` | Completed or healthy | confirmed work and successful status |
| `--ref-danger` | Blocking risk | errors and failures only |

## Implementation Boundaries

- Do not copy unreadable placeholder text, avatars, illustrations, or artwork from the reference.
- Preserve real Jessboard task, schedule, Codex, and news data in the layout.
- Every coloured state must have a text label or icon, a visible keyboard focus state, and sufficient text contrast.
- The concept must be adapted into functional desktop and mobile views before it replaces the current application UI.
