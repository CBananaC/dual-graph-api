document.addEventListener('DOMContentLoaded', () => {
    const container = document.querySelector('.content.text-page');
    const tabBar    = document.querySelector('.tab-bar');
    const chapNav   = document.querySelector('.chapter-nav');
    const links     = [...document.querySelectorAll('.chapter-nav a')];
    const sections  = links.map(a => document.getElementById(a.getAttribute('href').slice(1)));
  
    // 每次都重新算高度（万一 resize）
    function getTotalOffset() {
      return tabBar.offsetHeight + chapNav.offsetHeight;
    }
  
    links.forEach((link, i) => {
      link.addEventListener('click', e => {
        e.preventDefault();
        const totalOffset = getTotalOffset();
        // section.offsetTop 是相对于 container 内容区的顶部
        const targetY = sections[i].offsetTop - totalOffset;
        container.scrollTo({ top: targetY, behavior: 'smooth' });
        setActive(i);
      });
    });
  
    function setActive(idx) {
      links.forEach((a,j) => a.classList.toggle('active', j === idx));
    }
  
    // 保留你已有的滚动高亮逻辑...
    container.addEventListener('scroll', () => {
      const contTop = container.getBoundingClientRect().top;
      for (let i = sections.length - 1; i >= 0; i--) {
        if (sections[i].getBoundingClientRect().top <= contTop + 5) {
          setActive(i);
          break;
        }
      }
    });
  });