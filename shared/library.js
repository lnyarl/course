(() => {
  const q = document.getElementById('q');
  const courses = [...document.querySelectorAll('.course')];
  const filters = document.getElementById('filters');
  let category = '전체', searching = false;
  const previousOpen = new Map();
  courses.forEach(c => c.querySelectorAll('.t').forEach(t => t.dataset.raw = t.textContent));
  for (const name of ['전체', ...new Set(courses.map(c => c.dataset.category))]) {
    const button = document.createElement('button');
    button.type = 'button'; button.textContent = name;
    button.setAttribute('aria-pressed', String(name === category));
    button.onclick = () => { category = name; update(); };
    filters.append(button);
  }
  filters.hidden = false;
  function update() {
    const term = q.value.trim().toLowerCase();
    if (term && !searching) courses.forEach(c => previousOpen.set(c, c.querySelector('details').open));
    let visible = 0;
    courses.forEach(c => {
      const details = c.querySelector('details');
      const titleHit = !term || [c.dataset.title, c.querySelector('h2').textContent, c.querySelector('p').textContent].some(text => text.toLowerCase().includes(term));
      let hits = 0;
      c.querySelectorAll('.ch li').forEach(li => {
        const title = li.querySelector('.t'), raw = title.dataset.raw, at = raw.toLowerCase().indexOf(term);
        const hit = !term || at >= 0;
        li.hidden = !(hit || titleHit);
        title.replaceChildren();
        if (term && at >= 0) {
          const mark = document.createElement('mark'); mark.textContent = raw.slice(at, at + term.length);
          title.append(raw.slice(0, at), mark, raw.slice(at + term.length));
        } else title.textContent = raw;
        if (hit) hits++;
      });
      c.hidden = !((category === '전체' || c.dataset.category === category) && (titleHit || hits));
      if (term) details.open = !c.hidden;
      else if (searching) details.open = previousOpen.get(c) || false;
      if (!c.hidden) visible++;
    });
    searching = !!term;
    [...filters.children].forEach(button => button.setAttribute('aria-pressed', String(button.textContent === category)));
    document.getElementById('results').textContent = `${visible}개의 코스${term ? ' · 검색 결과' : ''}`;
    document.getElementById('empty').hidden = visible > 0;
    document.getElementById('reset-filters').hidden = visible > 0;
    document.getElementById('clear-search').hidden = !q.value;
  }
  q.addEventListener('input', update);
  document.getElementById('clear-search').onclick = () => { q.value = ''; update(); q.focus(); };
  document.getElementById('reset-filters').onclick = () => { q.value = ''; category = '전체'; update(); q.focus(); };
  update();
})();
