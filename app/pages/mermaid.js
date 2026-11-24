import {escape} from './utils';

/*
 * global mermaid
*/
const mermaidChart = (code) => `<div class="mermaid">${escape(code)}</div>`

const mermaidTheme = (theme) => (theme === 'dark' ? 'dark' : 'default')

const renderNodes = async (theme, maidOptions) => {
  // eslint-disable-next-line
  if (typeof mermaid === 'undefined') {
    return
  }
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
  // eslint-disable-next-line
  mermaid.initialize({ startOnLoad: false, theme: mermaidTheme(theme), ...(maidOptions || {}) })
  try {
    // eslint-disable-next-line
    await mermaid.run({ nodes, suppressErrors: true })
  } catch (e) { }
  nodes
    .filter((node) => node.isConnected && !node.querySelector('svg'))
    .forEach((node) => {
      const pre = document.createElement('pre')
      pre.textContent = node.dataset.source
      node.replaceWith(pre)
    })
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
