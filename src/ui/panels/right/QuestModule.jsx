import { QuestList } from "../../screens/QuestLogScreen.jsx";

export default function QuestModule({ questProgress = {}, flags = [], zoneTheme }) {
  return (
    <section aria-label="任务">
      <QuestList questProgress={questProgress} flags={flags} zoneTheme={zoneTheme} />
    </section>
  );
}
