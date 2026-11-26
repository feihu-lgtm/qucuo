import { QuestList } from "../../screens/QuestLogScreen.jsx";

export default function QuestModule({ questProgress = {}, flags = [] }) {
  return (
    <section aria-label="任务">
      <QuestList questProgress={questProgress} flags={flags} />
    </section>
  );
}
