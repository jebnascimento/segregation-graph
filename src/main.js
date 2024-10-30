import Sigma from 'sigma';
import Graph from 'graphology';
import { parse } from 'graphology-graphml';

function lightenColor(color, factor = 1.2) {
  const rgb = color.match(/\d+/g);
  if (rgb && rgb.length === 3) {
    const [r, g, b] = rgb.map(value => Math.min(255, Math.floor(value * factor)));
    return `rgb(${r}, ${g}, ${b})`;
  }
  return color;
}

// Função para buscar e processar o arquivo GraphML
async function loadGraph() {
  const response = await fetch('/src/s_network4.graphml');
  const graphml = await response.text();

  const graph = parse(Graph, graphml);
  graph.forEachNode((node, attributes) => {
    const forcedSize = 15;
    graph.setNodeAttribute(node, 'size', forcedSize);
    graph.setNodeAttribute(node, 'label', graph.getNodeAttribute(node, 'label') || '');
    graph.setNodeAttribute(node, 'font', {
      size: 12,
      family: 'Verdana',
      color: '#333333'
    });
  });
  graph.forEachEdge((edge, attributes, source, target) => {
    const sourceColor = graph.getNodeAttribute(source, 'color');
    const targetColor = graph.getNodeAttribute(target, 'color');
    const rgbColor = sourceColor || targetColor || 'rgb(0, 0, 0)';
    const transparentColor = rgbColor + "B3";
    graph.setEdgeAttribute(edge, 'color', transparentColor);
  });

  return graph;
}

// Renderizador personalizado para nós com círculos duplos e rótulos
const customNodeRenderer = (context, data) => {
  context.fillStyle = data.color || '#FF0000';
  context.beginPath();
  context.arc(data.x, data.y, data.size, 0, Math.PI * 2);
  context.fill();
  
  context.fillStyle = data.innerColor || '#0000FF';
  context.beginPath();
  context.arc(data.x, data.y, data.size, 0, Math.PI * 2);
  context.fill();

  const label = data.label || '';
  if (label) {
    context.fillStyle = data.font.color || '#000';
    context.font = `${data.font.size}px ${data.font.family}`;
    context.textAlign = 'center'; 
    context.textBaseline = 'middle'; 
    context.fillText(label, data.x, data.y - (data.size + 5));
  }
};

const customEdgeRenderer = (context, data) => {
  const opacity = data.opacity !== undefined ? data.opacity : 1;
  context.globalAlpha = opacity;

  const sourceColor = data.source.color || '#000000';
  const targetColor = data.target.color || '#000000';

  const gradient = context.createLinearGradient(data.source.x, data.source.y, data.target.x, data.target.y);
  gradient.addColorStop(0, sourceColor);
  gradient.addColorStop(1, targetColor);

  context.strokeStyle = gradient;
  
  context.beginPath();
  context.moveTo(data.source.x, data.source.y);
  context.lineTo(data.target.x, data.target.y);
  context.stroke();

  context.globalAlpha = 1;
};

// Função para lidar com o clique no nó e filtrar arestas
function handleNodeClick(event, graph, sigmaInstance, state) {
  const nodeId = event.node;

  if (state.filteredNode === nodeId) {
    graph.forEachNode((node) => graph.setNodeAttribute(node, 'hidden', false));
    graph.forEachEdge((edge) => graph.setEdgeAttribute(edge, 'hidden', false));
    state.filteredNode = null;
  } else {
    graph.forEachNode((node) => graph.setNodeAttribute(node, 'hidden', false));
    graph.forEachEdge((edge) => graph.setEdgeAttribute(edge, 'hidden', false));

    graph.forEachNode((node) => {
      if (node !== nodeId && !graph.hasEdge(nodeId, node) && !graph.hasEdge(node, nodeId)) {
        graph.setNodeAttribute(node, 'hidden', true);
      }
    });
    graph.forEachEdge((edge) => {
      const [source, target] = graph.extremities(edge);
      if (source !== nodeId && target !== nodeId) {
        graph.setEdgeAttribute(edge, 'hidden', true);
      }
    });

    state.filteredNode = nodeId;
  }

  sigmaInstance.refresh();
}

// Função para buscar um nó com base na entrada do usuário
function searchNode(graph, sigmaInstance) {
  const searchInput = document.getElementById('node-search');
  const query = searchInput.value.trim();

  if (!query) return;

  let foundNode = null;
  graph.forEachNode((node, attributes) => {
    if (attributes.label && attributes.label.toLowerCase() === query.toLowerCase()) {
      foundNode = node;
    }
  });

  if (foundNode) {
    graph.forEachNode((node) => graph.setNodeAttribute(node, 'hidden', true));
    graph.forEachEdge((edge) => graph.setEdgeAttribute(edge, 'hidden', true));

    graph.setNodeAttribute(foundNode, 'hidden', false);
    graph.forEachNeighbor(foundNode, (neighbor) => {
      graph.setNodeAttribute(neighbor, 'hidden', false);
      graph.forEachEdge((edge) => {
        const [source, target] = graph.extremities(edge);
        if ((source === foundNode && target === neighbor) || (target === foundNode && source === neighbor)) {
          graph.setEdgeAttribute(edge, 'hidden', false);
        }
      });
    });

    sigmaInstance.refresh();
  } else {
    alert('Nó não encontrado!');
  }
}

// Função para exibir sugestões de busca
function showSuggestions(graph) {
  const searchInput = document.getElementById('node-search');
  const suggestionsContainer = document.getElementById('suggestions');

  const query = searchInput.value.trim().toLowerCase();
  suggestionsContainer.innerHTML = '';

  if (query) {
    const suggestions = [];
    graph.forEachNode((node, attributes) => {
      if (attributes.label && attributes.label.toLowerCase().includes(query)) {
        suggestions.push(attributes.label);
      }
    });

    suggestions.forEach((label) => {
      const suggestionItem = document.createElement('li');
      suggestionItem.textContent = label;
      suggestionItem.style.padding = '8px';
      suggestionItem.style.cursor = 'pointer';

      suggestionItem.addEventListener('click', () => {
        searchInput.value = label;
        suggestionsContainer.style.display = 'none';
        searchNode(graph, sigmaInstance);
      });

      suggestionsContainer.appendChild(suggestionItem);
    });

    suggestionsContainer.style.display = suggestions.length ? 'block' : 'none';
  } else {
    suggestionsContainer.style.display = 'none';
  }
}

// Inicializar Sigma com o grafo carregado
loadGraph().then((graph) => {
  const container = document.getElementById('sigma-container');
  const searchInput = document.getElementById('node-search');
  const state = { filteredNode: null };

  const sigmaInstance = new Sigma(graph, container, {
    nodeRenderer: customNodeRenderer,
    edgeRenderer: customEdgeRenderer,    
  });

  sigmaInstance.on('clickNode', (event) => handleNodeClick(event, graph, sigmaInstance, state));

  document.getElementById('search-button').addEventListener('click', () => {
    searchNode(graph, sigmaInstance);
  });

  // Adiciona o evento de entrada de texto para exibir as sugestões de busca
  searchInput.addEventListener('input', () => showSuggestions(graph));
});
