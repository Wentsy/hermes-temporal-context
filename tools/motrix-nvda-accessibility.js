(() => {
  'use strict'

  const A11Y_MARK = 'data-motrix-nvda'
  const HIDDEN_MARK = 'data-motrix-nvda-hidden'
  let lastFocusBeforeDialog = null
  let activeDialog = null
  let scheduled = false

  const text = (value) => String(value || '').replace(/\s+/g, ' ').trim()
  const isEditable = (el) => {
    if (!el || el.nodeType !== 1) return false
    const tag = el.tagName
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable ||
      ['spinbutton', 'slider', 'combobox', 'textbox'].includes(el.getAttribute('role'))
  }

  const isVisible = (el) => {
    if (!el || el.nodeType !== 1) return false
    if (el.getAttribute('aria-hidden') === 'true') return false
    const style = window.getComputedStyle(el)
    return style.display !== 'none' && style.visibility !== 'hidden' && el.getClientRects().length > 0
  }

  const liveRegion = () => {
    let node = document.getElementById('motrix-nvda-live')
    if (!node) {
      node = document.createElement('div')
      node.id = 'motrix-nvda-live'
      node.setAttribute('aria-live', 'polite')
      node.setAttribute('aria-atomic', 'true')
      Object.assign(node.style, {
        position: 'fixed', left: '-10000px', top: '0', width: '1px', height: '1px', overflow: 'hidden'
      })
      document.body.appendChild(node)
    }
    return node
  }

  const announce = (message) => {
    const node = liveRegion()
    node.textContent = ''
    window.setTimeout(() => { node.textContent = message }, 10)
  }

  const describedText = (el) => {
    const ids = text(el && el.getAttribute && el.getAttribute('aria-describedby'))
    if (!ids) return ''
    return ids.split(/\s+/).map((id) => {
      const target = document.getElementById(id)
      return target ? text(target.textContent) : ''
    }).filter(Boolean).join(' ')
  }

  const staticText = (root) => {
    if (!root) return ''
    const clone = root.cloneNode(true)
    clone.querySelectorAll('input,textarea,select,button,svg,.el-input,.el-input-number,.el-select,.el-switch,.el-checkbox,.el-radio').forEach((n) => n.remove())
    return text(clone.textContent)
  }

  const formLabel = (el) => {
    const item = el.closest && el.closest('.el-form-item')
    if (!item) return ''
    const group = text(item.querySelector('.el-form-item__label')?.textContent).replace(/[：:]\s*$/, '')
    const sub = el.closest('.form-item-sub')
    const local = staticText(sub)
    if (local && group && local !== group) return `${group}，${local}`
    return local || group
  }

  const makeButton = (el, label) => {
    if (!el || !label) return
    el.setAttribute('aria-label', label)
    if (!['BUTTON', 'A', 'INPUT'].includes(el.tagName)) el.setAttribute('role', 'button')
    if (!el.hasAttribute('tabindex') || el.getAttribute('tabindex') === '-1') el.setAttribute('tabindex', '0')
    if (!el.hasAttribute(A11Y_MARK)) {
      el.setAttribute(A11Y_MARK, 'button')
      el.addEventListener('keydown', (event) => {
        if ((event.key === 'Enter' || event.key === ' ') && !isEditable(event.target)) {
          event.preventDefault()
          el.click()
        }
      })
    }
  }

  const hideInteractive = (el, keepVisual = true) => {
    if (!el) return
    el.setAttribute('aria-hidden', 'true')
    el.setAttribute('tabindex', '-1')
    el.setAttribute(HIDDEN_MARK, 'true')
    if (keepVisual) {
      el.style.pointerEvents = 'none'
    } else {
      el.style.display = 'none'
    }
    el.querySelectorAll?.('a,button,input,[tabindex],[role="button"]').forEach((child) => {
      child.setAttribute('aria-hidden', 'true')
      child.setAttribute('tabindex', '-1')
    })
  }

  const enhanceWindowAndBranding = () => {
    document.querySelectorAll('.title-bar .window-actions, .window-actions').forEach((el) => hideInteractive(el, true))

    document.querySelectorAll('a[href*="motrix.app"]').forEach((anchor) => {
      anchor.removeAttribute('href')
      anchor.removeAttribute('target')
      anchor.setAttribute('role', 'presentation')
      hideInteractive(anchor, true)
    })

    document.querySelectorAll('button,[role="button"],a,[tabindex]:not(input):not(textarea)').forEach((el) => {
      const label = text(el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent).toUpperCase()
      if (label === 'MAX') hideInteractive(el, false)
    })
  }

  const enhanceTaskToolbar = () => {
    const fallback = ['新增下載任務', '刪除所選任務', '重新整理任務列表', '全部開始', '全部暫停', '清除已完成紀錄']
    document.querySelectorAll('.task-actions').forEach((toolbar) => {
      const actions = [...toolbar.querySelectorAll('.task-action')]
      actions.forEach((action, index) => {
        const label = describedText(action) || text(action.getAttribute('title')) || fallback[index] || `任務操作 ${index + 1}`
        makeButton(action, label)
      })
    })
  }

  const iconActionLabel = (action, index) => {
    const svg = action.querySelector('svg')
    if (svg) {
      if (svg.querySelector('polygon[points="5,22 5,2 20,12"]')) return '繼續任務'
      if (svg.querySelector('rect[x="3"][y="2"][width="6"][height="20"]')) return '暫停任務'
      if (svg.querySelector('rect[x="2"][y="2"][width="20"][height="20"]')) return '停止做種'
      if (svg.querySelector('circle[cx="4"][cy="18"][r="3"]')) return '重新下載'
      if (svg.querySelector('line[x1="19"][y1="5"][x2="5"][y2="19"]')) return '刪除任務'
      if (svg.querySelector('polyline[points^="20,9 20,23"]')) return '刪除任務紀錄'
    }
    return ['任務詳細資訊', '複製下載連結', '開啟所在資料夾', '刪除任務', '開始或暫停任務'][index] || `任務操作 ${index + 1}`
  }

  const enhanceTaskItems = () => {
    document.querySelectorAll('.task-item').forEach((item) => {
      const name = text(item.querySelector('.task-name')?.textContent)
      const actions = [...item.querySelectorAll('.task-item-actions .task-item-action > i')]
      actions.forEach((action, index) => {
        const base = iconActionLabel(action, index)
        makeButton(action, name ? `${base}：${name}` : base)
      })
    })
  }

  const enhanceTorrentPicker = () => {
    document.querySelectorAll('.upload-torrent .el-upload-dragger, .upload-torrent .el-upload').forEach((el) => {
      if (!el.closest('.el-upload-dragger') || el.classList.contains('el-upload-dragger')) makeButton(el, '選擇 Torrent 檔案')
    })
    document.querySelectorAll('.upload-torrent input[type="file"]').forEach((el) => el.setAttribute('aria-label', '選擇 Torrent 檔案'))
    document.querySelectorAll('.torrent-actions > span').forEach((el) => makeButton(el, '移除 Torrent 檔案'))

    const filters = ['只選影片檔案', '只選音訊檔案', '只選圖片檔案']
    document.querySelectorAll('.file-filters .quick-filters button').forEach((button, index) => {
      button.setAttribute('aria-label', filters[index] || `檔案篩選 ${index + 1}`)
    })

    document.querySelectorAll('.mo-task-files .el-table__body-wrapper tbody tr').forEach((row) => {
      const checkbox = row.querySelector('input[type="checkbox"]')
      if (!checkbox) return
      const cells = [...row.querySelectorAll('td .cell')]
      const filename = text(cells[1]?.textContent || cells[0]?.textContent)
      checkbox.setAttribute('aria-label', filename ? `選取檔案：${filename}` : '選取檔案')
    })
    document.querySelectorAll('.mo-task-files .el-table__header-wrapper input[type="checkbox"]').forEach((checkbox) => {
      checkbox.setAttribute('aria-label', '選取全部檔案')
    })
  }

  const enhanceDirectories = () => {
    document.querySelectorAll('.mo-history-directory button').forEach((button) => {
      button.setAttribute('aria-label', '歷史下載資料夾')
      if (!button.hasAttribute('data-motrix-history-key')) {
        button.setAttribute('data-motrix-history-key', 'true')
        button.addEventListener('keydown', (event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return
          event.preventDefault()
          button.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }))
          window.setTimeout(() => {
            const first = [...document.querySelectorAll('.mo-directory-popper .mo-directory-list > li')].find(isVisible)
            if (first) first.focus()
          }, 80)
        })
      }
    })

    document.querySelectorAll('.select-directory button, button.select-directory').forEach((button) => {
      const inPreferences = !!button.closest('.form-preference')
      button.setAttribute('aria-label', inPreferences ? '選擇預設下載資料夾' : '選擇下載資料夾')
    })

    document.querySelectorAll('.mo-directory-popper .mo-directory-list > li').forEach((li) => {
      const path = text(li.querySelector('.mo-directory-path')?.textContent)
      makeButton(li, path ? `選擇資料夾：${path}` : '選擇資料夾')
      li.querySelectorAll('.icon-history-favorite').forEach((el) => makeButton(el, path ? `加入常用資料夾：${path}` : '加入常用資料夾'))
      li.querySelectorAll('.icon-history-favorited').forEach((el) => makeButton(el, path ? `取消常用資料夾：${path}` : '取消常用資料夾'))
      li.querySelectorAll('.icon-history-remove').forEach((el) => makeButton(el, path ? `移除歷史資料夾：${path}` : '移除歷史資料夾'))
    })
  }

  const enhanceForms = () => {
    document.querySelectorAll('.el-form input, .el-form textarea').forEach((input) => {
      if (input.type === 'hidden' || input.type === 'file') return
      let label = formLabel(input)
      if (!label) label = text(input.getAttribute('placeholder'))
      if (input.closest('.el-select') && label) label = `${label}，選項`
      if (label) input.setAttribute('aria-label', label)

      if (input.closest('.el-input-number')) {
        input.setAttribute('role', 'spinbutton')
        const wrapper = input.closest('.el-input-number')
        const dec = wrapper?.querySelector('.el-input-number__decrease')
        const inc = wrapper?.querySelector('.el-input-number__increase')
        if (dec) makeButton(dec, label ? `${label}，減少` : '減少數值')
        if (inc) makeButton(inc, label ? `${label}，增加` : '增加數值')
      }
    })

    document.querySelectorAll('.el-form label.el-checkbox').forEach((labelEl) => {
      const input = labelEl.querySelector('input[type="checkbox"]')
      const label = text(labelEl.textContent)
      if (input && label) input.setAttribute('aria-label', label)
    })

    document.querySelectorAll('.el-form .el-switch').forEach((sw) => {
      const label = text(sw.querySelector('.el-switch__label')?.textContent) || formLabel(sw) || '切換設定'
      sw.setAttribute('role', 'switch')
      sw.setAttribute('aria-label', label)
      sw.setAttribute('aria-checked', sw.classList.contains('is-checked') ? 'true' : 'false')
      if (!sw.hasAttribute('tabindex')) sw.setAttribute('tabindex', '0')
      if (!sw.hasAttribute('data-motrix-switch-key')) {
        sw.setAttribute('data-motrix-switch-key', 'true')
        sw.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            sw.click()
          }
        })
      }
    })

    document.querySelectorAll('.form-actions button').forEach((button) => {
      const label = text(button.textContent)
      if (label) button.setAttribute('aria-label', label)
    })
  }

  const enhanceSettingsClose = () => {
    const onPreferences = /#\/preference(?:\/|$)/.test(window.location.hash)
    document.querySelectorAll('[data-motrix-close-settings="true"]').forEach((button) => {
      if (!onPreferences) button.remove()
    })
    if (!onPreferences) return

    document.querySelectorAll('.form-actions').forEach((actions) => {
      if (actions.querySelector('[data-motrix-close-settings="true"]')) return
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'el-button el-button--default el-button--mini'
      button.setAttribute('data-motrix-close-settings', 'true')
      button.setAttribute('aria-label', '關閉設定並返回下載列表')
      button.textContent = '關閉設定'
      button.addEventListener('click', () => {
        window.location.hash = '#/task'
      })
      actions.appendChild(button)
    })
  }

  const enhanceSaveAnnouncements = () => {
    document.querySelectorAll('.form-actions button').forEach((button) => {
      const label = text(button.textContent)
      if (/^(保存|儲存|Save)$/i.test(label) && !button.hasAttribute('data-motrix-save-live')) {
        button.setAttribute('data-motrix-save-live', 'true')
        button.addEventListener('click', () => announce('正在儲存設定'))
      }
    })
    document.querySelectorAll('.el-message').forEach((message) => {
      if (!message.hasAttribute('data-motrix-message-live')) {
        message.setAttribute('data-motrix-message-live', 'true')
        const msg = text(message.textContent)
        if (msg) announce(msg)
      }
    })
  }

  const dialogFocusable = (dialog) => [...dialog.querySelectorAll(
    'textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), button:not([disabled]), [role="button"][tabindex]:not([tabindex="-1"]), a[href]'
  )].find((el) => isVisible(el) && !el.classList.contains('el-dialog__headerbtn'))

  const enhanceDialogs = () => {
    if (activeDialog && (!activeDialog.isConnected || !isVisible(activeDialog))) {
      activeDialog = null
      if (lastFocusBeforeDialog && lastFocusBeforeDialog.isConnected && isVisible(lastFocusBeforeDialog)) {
        window.setTimeout(() => lastFocusBeforeDialog.focus(), 20)
      }
      lastFocusBeforeDialog = null
    }

    if (activeDialog) return
    const wrapper = [...document.querySelectorAll('.el-dialog__wrapper')].find(isVisible)
    if (!wrapper) return
    const dialog = wrapper.querySelector('.el-dialog') || wrapper
    if (dialog.hasAttribute('data-motrix-dialog-focused')) {
      activeDialog = wrapper
      return
    }
    dialog.setAttribute('data-motrix-dialog-focused', 'true')
    lastFocusBeforeDialog = document.activeElement && document.activeElement !== document.body ? document.activeElement : null
    activeDialog = wrapper
    window.setTimeout(() => {
      const target = dialogFocusable(dialog)
      if (target) target.focus()
    }, 60)
  }

  const focusables = () => [...document.querySelectorAll(
    'button:not([disabled]), a[href], input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), select:not([disabled]), [role="button"][tabindex]:not([tabindex="-1"]), [role="switch"][tabindex]:not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])'
  )].filter((el, index, arr) => isVisible(el) && arr.indexOf(el) === index && !el.closest(`[${HIDDEN_MARK}="true"]`))

  const installArrowNavigation = () => {
    if (document.documentElement.hasAttribute('data-motrix-arrow-nav')) return
    document.documentElement.setAttribute('data-motrix-arrow-nav', 'true')
    document.addEventListener('keydown', (event) => {
      if (!['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(event.key)) return
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
      if (isEditable(event.target)) return
      const list = focusables()
      const current = list.indexOf(document.activeElement)
      if (current < 0 || list.length < 2) return
      const delta = (event.key === 'ArrowDown' || event.key === 'ArrowRight') ? 1 : -1
      const next = list[(current + delta + list.length) % list.length]
      if (next) {
        event.preventDefault()
        next.focus()
      }
    }, true)
  }

  const enhance = () => {
    scheduled = false
    try {
      enhanceWindowAndBranding()
      enhanceTaskToolbar()
      enhanceTaskItems()
      enhanceTorrentPicker()
      enhanceDirectories()
      enhanceForms()
      enhanceSettingsClose()
      enhanceSaveAnnouncements()
      enhanceDialogs()
      installArrowNavigation()
    } catch (error) {
      console.error('[Motrix NVDA] accessibility patch failed', error)
    }
  }

  const schedule = () => {
    if (scheduled) return
    scheduled = true
    window.requestAnimationFrame(enhance)
  }

  const start = () => {
    liveRegion()
    enhance()
    const observer = new MutationObserver(schedule)
    observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'aria-checked', 'aria-describedby'] })
    window.addEventListener('hashchange', schedule)
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true })
  else start()
})()
