// Jessboard design preview behavior: switches visual direction and keeps labels in sync with the selected option.
const directions = {
  command: {
    label: "01 / 安静指挥台",
    name: "稳定、克制，适合每天高频使用",
    description: "浅绿色与纸张白为主，导航用细下划线提示当前位置；动效只用于状态变化和页面切换。",
    title: "今天，先推进真正重要的事。",
    copy: "工作上下文已整理为清晰的下一步行动。",
    status: "3 项需要今天处理"
  },
  editorial: {
    label: "02 / 编辑部看板",
    name: "像一份只属于你的工作日报",
    description: "以大标题、数字和细分隔线建立阅读节奏；适合突出每日简报、项目进展与复盘内容。",
    title: "今天值得写进工作日报的三件事。",
    copy: "先读重点，再决定下一步。",
    status: "今日编辑完成度 68%"
  },
  studio: {
    label: "03 / AI STUDIO",
    name: "精准、前沿，更像现代 AI 产品",
    description: "深色产品界面配合高亮数据色，控件更紧凑；动效可更明显，但只服务于操作结果。",
    title: "把今天的注意力，投向高价值工作。",
    copy: "来自任务、项目和开发数据的即时工作信号。",
    status: "系统状态：准备就绪"
  },
  adaptive: {
    label: "04 / 轻量自适应",
    name: "轻松、友好，也最容易适配不同设备",
    description: "柔和色块和圆润组件让信息更易读；导航在较小屏幕自然收紧，适合移动端使用频繁的场景。",
    title: "让工作节奏，清楚又轻松。",
    copy: "看清重点，也为临时变化留出空间。",
    status: "今天的节奏很清晰"
  }
};

// Applies a selected design direction to the preview canvas and its explanatory text.
function selectDirection(theme) {
  const direction = directions[theme];
  if (!direction) return;
  document.body.className = `theme-${theme}`;
  document.querySelectorAll(".direction-tab").forEach((tab) => {
    const selected = tab.dataset.theme === theme;
    tab.classList.toggle("active", selected);
    tab.setAttribute("aria-selected", String(selected));
  });
  document.querySelector("#direction-label").textContent = direction.label;
  document.querySelector("#direction-name").textContent = direction.name;
  document.querySelector("#direction-description").textContent = direction.description;
  document.querySelector("#preview-title").textContent = direction.title;
  document.querySelector("#preview-copy").textContent = direction.copy;
  document.querySelector("#status-copy").textContent = direction.status;
}

// Connects each preview tab to the corresponding visual direction.
function bindDirectionTabs() {
  document.querySelectorAll(".direction-tab").forEach((tab) => {
    tab.addEventListener("click", () => selectDirection(tab.dataset.theme));
  });
}

bindDirectionTabs();
window.lucide?.createIcons();
