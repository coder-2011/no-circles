# Taskwarrior Planning Prompt

When planning a feature, convert work into task inventory before coding.

Process:
1. Break feature into 3-7 implementation tasks.
2. Add each task with project tag and priority:
   - `task add project:no-circles priority:H "..."`
   - `task add project:no-circles priority:M "..."`
3. Add due dates only when externally required.
4. Mark dependencies with annotations or sequencing in descriptions.
5. Start highest-value task first (`task next`).

Task quality bar:
- includes subsystem/file target
- includes user-visible or contract-level outcome
- can be verified by command/test
