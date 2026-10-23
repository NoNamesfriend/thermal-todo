<script>
  import mailIcon from '@fluentui/svg-icons/icons/mail_20_filled.svg?raw';
  import calendarIcon from '@fluentui/svg-icons/icons/calendar_20_filled.svg?raw';
  import checklistIcon from '@fluentui/svg-icons/icons/task_list_ltr_20_filled.svg?raw';
  import priorityIcon from '@fluentui/svg-icons/icons/flag_20_filled.svg?raw';
  import workIcon from '@fluentui/svg-icons/icons/briefcase_20_filled.svg?raw';
  import codeIcon from '@fluentui/svg-icons/icons/code_20_filled.svg?raw';
  import studyIcon from '@fluentui/svg-icons/icons/book_20_filled.svg?raw';
  import creativeIcon from '@fluentui/svg-icons/icons/pen_20_filled.svg?raw';
  import healthIcon from '@fluentui/svg-icons/icons/heart_20_filled.svg?raw';
  import fitnessIcon from '@fluentui/svg-icons/icons/dumbbell_20_filled.svg?raw';
  import homeIcon from '@fluentui/svg-icons/icons/home_20_filled.svg?raw';
  import shoppingIcon from '@fluentui/svg-icons/icons/cart_20_filled.svg?raw';
  import foodIcon from '@fluentui/svg-icons/icons/food_20_filled.svg?raw';
  import financeIcon from '@fluentui/svg-icons/icons/wallet_20_filled.svg?raw';
  import adminIcon from '@fluentui/svg-icons/icons/document_20_filled.svg?raw';
  import callIcon from '@fluentui/svg-icons/icons/call_20_filled.svg?raw';
  import travelIcon from '@fluentui/svg-icons/icons/airplane_20_filled.svg?raw';
  import maintenanceIcon from '@fluentui/svg-icons/icons/wrench_screwdriver_20_filled.svg?raw';
  import personalIcon from '@fluentui/svg-icons/icons/person_20_filled.svg?raw';
  import otherIcon from '@fluentui/svg-icons/icons/question_circle_20_filled.svg?raw';
  import micIcon from '@fluentui/svg-icons/icons/mic_24_regular.svg?raw';
  import stopIcon from '@fluentui/svg-icons/icons/stop_24_regular.svg?raw';
  import printIcon from '@fluentui/svg-icons/icons/print_24_regular.svg?raw';
  import settingsIcon from '@fluentui/svg-icons/icons/settings_24_regular.svg?raw';
  export let name;
  const icons = { mail: mailIcon, calendar: calendarIcon, checklist: checklistIcon, priority: priorityIcon, work: workIcon, code: codeIcon, study: studyIcon, creative: creativeIcon, health: healthIcon, fitness: fitnessIcon, home: homeIcon, shopping: shoppingIcon, food: foodIcon, finance: financeIcon, admin: adminIcon, call: callIcon, travel: travelIcon, maintenance: maintenanceIcon, personal: personalIcon, other: otherIcon, mic: micIcon, stop: stopIcon, print: printIcon, settings: settingsIcon };
</script>
<span aria-hidden="true">{@html Object.hasOwn(icons, name) ? icons[name] : icons.other}</span>
<style>
  span { display: inline-flex; width: 1.25em; height: 1.25em; flex-shrink: 0; }
  span :global(svg) { width: 100%; height: 100%; fill: currentColor; }
</style>
