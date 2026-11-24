import {escape} from './utils';

const mermaidChart = (code) => `<div class="mermaid">${escape(code)}</div>`

const mermaidTheme = (theme) => (theme === 'dark' ? 'dark' : 'default')

const RENDER_TIMEOUT_MS = 10000

const isRendered = (node) => {
  const svg = node.querySelector('svg')
  return !!svg && svg.getAttribute('aria-roledescription') !== 'error'
}

const showSourceOfUnrendered = (nodes) => {
  nodes
    .filter((node) => node.isConnected && !isRendered(node))
    .forEach((node) => {
      const pre = document.createElement('pre')
      pre.textContent = node.dataset.source
      node.replaceWith(pre)
    })
}

const withTimeout = (promise, ms) => {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('mermaid render timed out')), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

const drawNodes = async (nodes, theme, maidOptions) => {
  const { mermaid } = window
  if (!mermaid) {
    return
  }
  mermaid.initialize({ startOnLoad: false, theme: mermaidTheme(theme), ...(maidOptions || {}) })
  const valid = []
  for (const node of nodes) {
    if (await mermaid.parse(node.dataset.source, { suppressErrors: true })) {
      valid.push(node)
    }
  }
  if (valid.length) {
    await mermaid.run({ nodes: valid, suppressErrors: true })
  }
}

const renderNodes = async (theme, maidOptions) => {
  const nodes = Array.from(document.querySelectorAll('.mermaid'))
  if (!nodes.length) {
    return
  }
  // mermaid replaces the source with the SVG; keep it so a theme change can re-render.
  nodes.forEach((node) => {
    if (node.dataset.source === undefined) {
      node.dataset.source = node.textContent
    }
    node.removeAttribute('data-processed')
    node.textContent = node.dataset.source
  })
  try {
    await withTimeout(drawNodes(nodes, theme, maidOptions), RENDER_TIMEOUT_MS)
  } catch (e) { }
  showSourceOfUnrendered(nodes)
}

let pendingRender = Promise.resolve()

// Serialized: overlapping runs would reset nodes another run is still drawing into.
export const renderMermaid = (theme, maidOptions) => {
  pendingRender = pendingRender
    .then(() => renderNodes(theme, maidOptions))
    .catch(() => {})
  return pendingRender
}

const MermaidPlugin = (md) => {
  const origin = md.renderer.rules.fence.bind(md.renderer.rules)
  md.renderer.rules.fence = (tokens, idx, options, env, slf) => {
    const token = tokens[idx]
    const code = token.content.trim()
    if (typeof token.info === 'string' && token.info.trim() === 'mermaid') {
      return mermaidChart(code)
    }
    const firstLine = code.split(/\n/)[0].trim()
    if (firstLine === 'gantt' ||
      firstLine === 'sequenceDiagram' ||
      firstLine === 'erDiagram' ||
      firstLine.match(/^graph (?:TB|BT|RL|LR|TD);?$/)) {
      return mermaidChart(code)
    }
    return origin(tokens, idx, options, env, slf)
  }
}

export default MermaidPlugin
