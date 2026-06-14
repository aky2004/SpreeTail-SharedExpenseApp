# AI Usage & Prompt Debugging Log

This document tracks the explicit usage of AI tools during the development lifecycle of SpreeTail, detailing the prompts that drove major architectural shifts, and critically analyzing three distinct instances where the AI generated flawed code, diagnosing the root cause, and outlining the corrective actions taken.

## Tools Utilized
- **Antigravity IDE (powered by Gemini & Claude Models)**: Deployed as an autonomous, agentic pair-programmer. It was granted read/write access to the local filesystem and terminal to actively scaffold the React/Node architecture, design the custom CSS system, and write the backend anomaly detection engine.
- **Claude (Web Interface)**: Utilized externally by the developer to generate highly complex, edge-case laden sample CSV datasets (incorporating typos, ambiguous dates, and formatting inconsistencies) to rigorously stress-test the backend ingestion engine's limits.

---

## Key Prompts & Generative Results

1. **Prompt**: *"restyle it completely from top to bottom like ui developer....still looks dull & basic"*
   - **Result**: Triggered a massive refactoring of the global CSS architecture. The AI stripped out generic styling and implemented the custom "Obsidian Ink" aesthetic. This involved introducing CSS variables for targeted dark-mode theming (`rgba(13, 13, 28, 0.98)` backgrounds), hardware-accelerated glassmorphism (`backdrop-filter: blur(30px)`), and deep, layered box-shadows to create a premium, spatial feel.

2. **Prompt**: *"add some animation,hovering glow and little trasfor tyoe of some mordern minimal effects"*
   - **Result**: Led to the programmatic implementation of reusable utility classes like `.hover-lift` (applying a `transform: translateY(-2px)` with a smooth Bezier curve transition) and `.animate-fade-in`. It also introduced dynamic, color-shifting borders on hover states across the React application cards, significantly elevating the UX responsiveness.

3. **Prompt**: *"fix this page styling...as it is all seems tp be grouped/cluttered/placed together in left top side...make things evenly distributed"*
   - **Result**: Forced a restructuring of the flexbox layout constraints on the CSV Import page, resulting in the progress stepper and upload form breaking out of their hardcoded pixel widths to fluidly fill the screen.

---

## AI Mistakes, Diagnostics & Corrections

Developing complex systems entirely with an AI pair-programmer inevitably leads to edge-case failures and context-loss bugs. Below are three concrete cases where the AI produced incorrect output, how the issue surfaced, and the exact steps taken to resolve it.

### Case 1: Over-Constrained CSS Layouts Breaking Fluidity
- **What went wrong**: When designing the CSV Import page UI, the AI hardcoded a strict `maxWidth: 600px` onto the upload dropzone container and a `max-w-lg` class onto the progress stepper HUD. Because these were block elements inside a standard flex container without `margin: auto` or `flex: 1` properties, they defaulted to clustering awkwardly in the extreme top-left corner of the 1440px wide dashboard workspace.
- **How it was caught**: Purely via visual inspection. The import page looked entirely unbalanced, claustrophobic, and fundamentally broken compared to the data tables on other pages, which naturally expanded to fill the available width.
- **What was changed**: I explicitly prompted the AI to distribute elements evenly. The AI realized its mistake, removed the strict pixel constraints (`maxWidth: 600px`), and replaced them with `w-full` and `flex: 1` directives on the parent wrappers, while centering the internal content using `flex-col items-center`. This allowed the components to fluidly fill the screen width in line with the established design system.

### Case 2: Malformed JSX Parsing Error Triggering Compiler Crash
- **What went wrong**: During a bulk stylistic update to `Expenses.tsx` to apply the new "Obsidian Ink" background and border colors, the AI utilized a targeted file-replacement tool. However, its regex/chunk replacement logic was slightly off, and it accidentally deleted the opening `<div ` bracket of the Expense Details drawer wrapper. It left raw properties (`className="w-full..." style={{...}}`) floating naked inside the JSX block.
- **How it was caught**: The Vite compiler immediately crashed and threw a fatal error. The browser displayed a massive red overlay: `[PARSE_ERROR] Unexpected token. Did you mean {'{'} {'}'} or &rbrace;?`. Furthermore, the TypeScript language server complained that `background does not exist on type ReactElement`.
- **What was changed**: I copied the console error directly to the AI (`"Explain what this problem is and help me fix it..."`). The AI read the file around the line number provided by the stack trace, realized it had physically deleted the `<div ` tag, and used a targeted string-replacement tool to restore the tag. *Note: It subsequently had to do a second pass to add the missing closing `</div>` tag at the bottom of the file when a secondary unbalanced DOM tree error occurred.*

### Case 3: SQL Unique Constraint Violation in CSV Batch Insert
- **What went wrong**: When writing the backend anomaly detection logic to handle "Unknown Members" (names in a CSV that don't exist in the database), the AI wrote a function (`resolveMemberName`) that automatically created a dummy database user and inserted them into the `group_members` table on the fly. 
- **The Bug**: If the *same* unknown person appeared in multiple consecutive rows of the CSV, the AI would try to create and insert them a second time. This happened because while the AI inserted the user into PostgreSQL, it failed to push the newly created user into its own local, in-memory array (`groupMembers`) that it was using to check for existence during the loop.
- **How it was caught**: When testing the CSV upload feature with the edge-case file provided by Claude, the network tab threw a `400 Bad Request`. The UI surfaced the raw Postgres database error: `duplicate key value violates unique constraint "group_members_group_id_user_id_joined_at_key"`.
- **What was changed**: I pointed the AI at the exact console error text. The AI investigated `import.service.ts`, traced the logic, and realized the in-memory array was stale. The fix involved adding a simple `groupMembers.push({...})` immediately after a successful database insertion so that any subsequent rows in the CSV would instantly recognize the newly created member and skip the duplicate DB insert.
