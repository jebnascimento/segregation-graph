import Sigma from 'sigma';
import Graph from 'graphology';
import { parse } from 'graphology-graphml';

// Function to fetch and parse GraphML
async function loadGraph() {
  const response = await fetch('/src/s_network2.graphml'); // Make sure this file path is correct based on your structure
  const graphml = await response.text();

  // Parse the GraphML content into a Graphology graph
  const graph = parse(Graph, graphml);

  return graph;
}

// Custom renderer for dual circles
const customNodeRenderer = (context, data) => {
  // Outer circle
  context.fillStyle = data.color || '#FF0000'; // Default to red if no color is provided
  context.beginPath();
  context.arc(data.x, data.y, data.size, 0, Math.PI * 2);
  context.fill();

  // Inner circle
  context.fillStyle = data.innerColor || '#0000FF'; // Default to blue if no inner color is provided
  context.beginPath();
  context.arc(data.x, data.y, data.innerSize || data.size * 0.5, 0, Math.PI * 2); // Inner circle is half the size by default
  context.fill();
};

// Initialize Sigma with the loaded graph
loadGraph().then((graph) => {
  const container = document.getElementById('sigma-container');

  // Create Sigma instance with custom rendering
  new Sigma(graph, container, {
    nodeRenderer: customNodeRenderer,
  });
});
