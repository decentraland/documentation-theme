'use strict';

{{ $searchDataFile := printf "%s.search-data.json" .Language.Lang }}
{{ $searchData := resources.Get "search-data.json" | resources.ExecuteAsTemplate $searchDataFile . | resources.Minify | resources.Fingerprint }}

(function () {
  const searchDataURL = '{{ $searchData.RelPermalink }}';
  const input = document.querySelector('#book-search-input');
  const searchOverlay = document.querySelector('#search-overlay')
  const resultsContainer = document.querySelector('#book-search-hits');
  const results = document.querySelector('#book-search-results ul');
  const LIMIT_RESULTS = 5
  const documents = new Map()

  if (!input) {
    return
  }

  // Listeners
  input.addEventListener('focus', init);
  input.addEventListener('keyup', search);
  document.addEventListener('keypress', focusSearchFieldOnKeyPress);
  searchOverlay.addEventListener('click', () => {
    hideSearchBox()
  })


  /**
   * @param {Event} event
   */
  function focusSearchFieldOnKeyPress(event) {
    if (event.target.value !== undefined) {
      return;
    }

    if (input === document.activeElement) {
      return;
    }

    const characterPressed = String.fromCharCode(event.charCode);
    if (!isHotkey(characterPressed)) {
      return;
    }

    input.focus();
    event.preventDefault();
  }

  /**
   * @param {String} character
   * @returns {Boolean}
   */
  function isHotkey(character) {
    const dataHotkeys = input.getAttribute('data-hotkeys') || '';
    return dataHotkeys.indexOf(character) >= 0;
  }

  function init() {
    input.removeEventListener('focus', init); // init once
    input.required = true;
    fetch(searchDataURL)
      .then(pages => pages.json())
      .then(pages => {
        window.lunrIdx = lunr(function() {
          this.ref('id')
          this.field('id')
          this.field('content')
          this.field('href')
          this.metadataWhitelist = ['position']
          for (const page of pages) {
            documents.set(page.id, page)
            this.add(page);
          }
        })
      })
      .then(() => input.required = false)
      .then(search);
  }

  function search() {
    if (input.required) {
      return
    }

    while (results.firstChild) {
      results.removeChild(results.firstChild);
    }

    if (!input.value || input.value.length < 3) {
      hideSearchBox()
      return;
    }
    function searchValue(fuzzy) {
      return input.value.split(' ').map(val => {
        if (val.length <= 4 || !fuzzy) return `+${val}`
        return `+${val}~1`
      }).join(' ')
    }
    function getSearchHits() {
      const hits = window.lunrIdx.search(searchValue()).slice(0, LIMIT_RESULTS);
      if (hits.length) return hits
      return window.lunrIdx.search(searchValue(true)).slice(0, LIMIT_RESULTS);
    }
    const searchHits = getSearchHits()
    if (!searchHits.length) {
      hideSearchBox()
      // TODO: show not found
      return
    }
    showSearchBox()
    searchHits.forEach(function (hit) {
      const document = documents.get(Number(hit.ref))
      if (!document) return
      const li = element('<li><a href><h4></h4><span></span></a></li>');
      const a = li.querySelector('a');
      const title = li.querySelector('h4');
      const content = li.querySelector('span');

      a.href = document.href;
      title.textContent = document.title;
      content.innerHTML = highlightContent(document.content, hit)
      results.appendChild(li);
    });
  }

  function highlightContent(content, hit) {
    const amountLetters = 60
    const { metadata } = hit.matchData
    let from = 0
    let to = 100
    const keys = Object.keys(metadata).sort()
    for (const key of keys) {
      const positions = metadata[key]?.content?.position
      if (!positions) {
        continue
      }
      for (const position of positions) {
        const positionStart = position[0]
        from = Math.max(0, content.length - positionStart <= amountLetters
          ? positionStart - amountLetters * 2
          : positionStart - amountLetters)
        to = positionStart + position[1] + amountLetters
      }
      break
    }
    let value = content.slice(from, to)
    if (from !== 0) {
      value = `...${value}`
    }
    for (const key of keys) {
      value = value.replace(new RegExp(key, 'gi'), '<strong>$&</strong>')
    }

    return value + '...'
  }

  // HELPERS
  /**
   * @param {String} content
   * @returns {Node}
   */
  function element(content) {
    const div = document.createElement('div');
    div.innerHTML = content;
    return div.firstChild;
  }

    function hide(element) {
    element.classList.add('hidden')
  }

  function show(element) {
    element.classList.remove('hidden')
  }

  function showSearchBox() {
    show(searchOverlay)
    show(resultsContainer)
  }

  function hideSearchBox() {
    hide(searchOverlay)
    hide(resultsContainer)
  }
})();
