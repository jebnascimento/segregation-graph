import Sigma from 'sigma';
import Graph from 'graphology';
import { parse } from 'graphology-graphml';
import { createNodeBorderProgram, NodeBorderProgram } from "@sigma/node-border";
import EdgeCurveProgram from "@sigma/edge-curve";





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
    graph.setNodeAttribute(node, 'borderColor', '#b3b3b3');
    graph.setNodeAttribute(node, 'borderSize', 0);
    graph.setNodeAttribute(node, "labelFont", "bold 8pt Tahoma");
    console.log('Nó:', node, attributes);    
    const isInnerCircle = attributes.size < 20; // Exemplo: identifica nós menores como parte do círculo interno
    graph.setNodeAttribute(node, 'innerCircle', isInnerCircle);
  });
  graph.forEachEdge((edge, attributes, source, target) => {
    const sourceColor = graph.getNodeAttribute(source, 'color');
    const targetColor = graph.getNodeAttribute(target, 'color');
    const rgbColor = sourceColor || targetColor || 'rgb(0, 0, 0)';
    const transparentColor = rgbColor + "E6";
    graph.setEdgeAttribute(edge, 'color', transparentColor);
    
  });
 
  return graph;
}

function highlightNode(nodeId, graph, sigmaInstance) {
  // Ajusta a opacidade para todos os nós e arestas
  graph.forEachNode((node) => {
    graph.setNodeAttribute(node, 'opacity', 0.2); // Nós não relacionados ficam mais transparentes
  });

  graph.forEachEdge((edge) => {
    graph.setEdgeAttribute(edge, 'opacity', 0.2); // Arestas não relacionadas ficam mais transparentes
  });

  // Mantém opacidade total para o nó selecionado e seus vizinhos
  graph.setNodeAttribute(nodeId, 'opacity', 1); // Nó selecionado em destaque
  graph.forEachNeighbor(nodeId, (neighbor) => {
    graph.setNodeAttribute(neighbor, 'opacity', 1); // Vizinhos em destaque
  });

  // Mantém opacidade total para as arestas conectadas ao nó selecionado
  graph.forEachEdge((edge, attributes, source, target) => {
    if (source === nodeId || target === nodeId) {
      graph.setEdgeAttribute(edge, 'opacity', 1); // Arestas conectadas em destaque
    }
  });

  sigmaInstance.refresh(); // Atualiza a visualização
}


// Função para lidar com o clique no nó e filtrar arestas
function handleNodeClick(event, graph, sigmaInstance, state) {
  const nodeId = event.node; // ID do nó clicado

  // Se não armazenamos os atributos originais, faça isso na primeira execução
  if (!state.originalAttributes) {
    state.originalAttributes = {
      nodes: new Map(),
      edges: new Map(),
    };

    // Armazena os atributos originais dos nós
    graph.forEachNode((node) => {
      state.originalAttributes.nodes.set(node, {
        color: graph.getNodeAttribute(node, "color"),
        size: graph.getNodeAttribute(node, "size"),
        hidden: graph.getNodeAttribute(node, "hidden"),
      });
    });

    // Armazena os atributos originais das arestas
    graph.forEachEdge((edge) => {
      state.originalAttributes.edges.set(edge, {
        color: graph.getEdgeAttribute(edge, "color"),
        hidden: graph.getEdgeAttribute(edge, "hidden"),
      });
    });
  }

  // Verifica se o nó clicado já está selecionado
  if (state.filteredNode === nodeId) {
    // Restaura os atributos originais de todos os nós
    state.originalAttributes.nodes.forEach((attributes, node) => {
      graph.setNodeAttribute(node, "color", attributes.color);
      graph.setNodeAttribute(node, "size", attributes.size);
      graph.setNodeAttribute(node, "hidden", attributes.hidden);
    });

    // Restaura os atributos originais de todas as arestas
    state.originalAttributes.edges.forEach((attributes, edge) => {
      graph.setEdgeAttribute(edge, "color", attributes.color);
      graph.setEdgeAttribute(edge, "hidden", attributes.hidden);
    });

    // Reseta o estado
    state.filteredNode = null;
  } else {
    // Aplica o filtro para destacar o nó selecionado
    graph.forEachNode((node) => {
      if (node !== nodeId && !graph.hasEdge(nodeId, node) && !graph.hasEdge(node, nodeId)) {
        graph.setNodeAttribute(node, "color", "#f3f3f3"); // Nó não conectado
      } else {
        const originalColor = state.originalAttributes.nodes.get(node).color;
        graph.setNodeAttribute(node, "color", originalColor); // Nó conectado ou selecionado
      }
    });

    graph.forEachEdge((edge) => {
      const [source, target] = graph.extremities(edge);
      if (source !== nodeId && target !== nodeId) {
        graph.setEdgeAttribute(edge, "hidden", true); // Esconde arestas não conectadas
      } else {
        graph.setEdgeAttribute(edge, "hidden", false); // Mostra arestas conectadas
      }
    });

    // Atualiza o estado com o nó selecionado
    state.filteredNode = nodeId;
  }

  // Atualiza a visualização
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
  const nodeList = document.getElementById('node-list'); // Lista fixa

  const sigmaInstance = new Sigma(graph, container, {
    defaultNodeType: "bordered",
    drawingProperties: {labelThreshold: 0},
    nodeProgramClasses: {
      bordered:  createNodeBorderProgram({
        borders: [
          { size: { attribute: "borderSize", defaultValue: 0.05 }, color: { attribute: "borderColor" } },
          { size: { fill: true }, color: { attribute: "color" } },
        ],
      }),
    },
    defaultEdgeType: "curve",
    edgeProgramClasses: {
      curve: EdgeCurveProgram,
    },   
  
  });

  if (!state.originalAttributes) {
    state.originalAttributes = {
      nodes: new Map(),
      edges: new Map(),
    };

    // Armazena os atributos originais dos nós
    graph.forEachNode((node) => {
      state.originalAttributes.nodes.set(node, {
        color: graph.getNodeAttribute(node, "color"),
        size: graph.getNodeAttribute(node, "size"),
        hidden: graph.getNodeAttribute(node, "hidden"),
      });
    });

    // Armazena os atributos originais das arestas
    graph.forEachEdge((edge) => {
      state.originalAttributes.edges.set(edge, {
        color: graph.getEdgeAttribute(edge, "color"),
        hidden: graph.getEdgeAttribute(edge, "hidden"),
      });
    });
  }
  
  const innerCircleNodes = [];
  graph.forEachNode((node, attributes) => {
    const isInnerCircle = attributes.size < 30; // Exemplo: define círculo interno
    graph.setNodeAttribute(node, 'innerCircle', isInnerCircle);

    if (isInnerCircle) {
      innerCircleNodes.push({ id: node, label: attributes.label, color: attributes.color });
    }
  }); 
   
  // Adiciona os 20 primeiros itens na lista
  innerCircleNodes.slice(0, 32).forEach((node) => {
    const listItem = document.createElement('li');
    listItem.textContent = node.label || `Node ${node.id}`;
    listItem.dataset.nodeId = node.id; // Associa o ID do nó ao item
    listItem.style.backgroundColor = node.color || '#007bff'; // Cor de fundo
    nodeList.appendChild(listItem);
  });
  
  sigmaInstance.on('clickNode', (event) => handleNodeClick(event, graph, sigmaInstance, state));
  
  document.getElementById('search-button').addEventListener('click', () => {
    searchNode(graph, sigmaInstance);
  });

  function filterGraphByNode(nodeId) {
    graph.forEachNode((node) => {
      const connected = node === nodeId || graph.hasEdge(nodeId, node) || graph.hasEdge(node, nodeId);
      graph.setNodeAttribute(node, 'hidden', !connected);
    });

    graph.forEachEdge((edge, attributes, source, target) => {
      const connected = source === nodeId || target === nodeId;
      graph.setEdgeAttribute(edge, 'hidden', !connected);
    });

    sigmaInstance.refresh(); // Atualiza a visualização
  }

  nodeList.addEventListener('click', (event) => {
    const listItem = event.target.closest('li'); // Garante que clicou em um item da lista
    if (!listItem) return;

    const nodeId = listItem.dataset.nodeId; // Obtém o ID do nó associado
    filterGraphByNode(nodeId); // Aplica o filtro no grafo
  });
  
  // Adiciona o evento de entrada de texto para exibir as sugestões de busca
  searchInput.addEventListener('input', () => showSuggestions(graph));
  sigmaInstance.addPlugin(NodeBorder);
});
