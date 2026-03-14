import { describe, test, expect, beforeAll, jest } from '@jest/globals';

let reducer;
let applyGraphPatch;
let setSelectedNode;
let setGraphData;

beforeAll(async () => {
  global.localStorage = {
    getItem: jest.fn(() => null),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  };

  const graphSliceModule = await import('../src/store/slices/graphSlice.js');
  reducer = graphSliceModule.default;
  applyGraphPatch = graphSliceModule.applyGraphPatch;
  setSelectedNode = graphSliceModule.setSelectedNode;
  setGraphData = graphSliceModule.setGraphData;
});

describe('Webhook UI contract', () => {
  test('applyGraphPatch replaces graph data for the active repo', () => {
    let state = reducer(undefined, {
      type: '@@INIT',
    });

    state = reducer(state, setGraphData({
      repoId: 'repo-1',
      graphData: {
        nodes: [{ id: 'file:src/index.js', name: 'src/index.js', type: 'FILE' }],
        edges: [],
      },
    }));

    state = reducer(state, applyGraphPatch({
      repoId: 'repo-1',
      patch: {
        graphData: {
          nodes: [
            { id: 'file:src/index.js', name: 'src/index.js', type: 'FILE' },
            { id: 'function:src/index.js#farewell', name: 'farewell', type: 'FUNCTION', file: 'src/index.js' },
          ],
          edges: [],
          summary: { nodes: 2, edges: 0 },
        },
        removedNodeIds: [],
      },
    }));

    expect(state.graphData.nodes).toHaveLength(2);
    expect(state.graphData.nodes.some((node) => node.name === 'farewell')).toBe(true);
  });

  test('applyGraphPatch clears selection when the selected node is removed', () => {
    let state = reducer(undefined, {
      type: '@@INIT',
    });

    state = reducer(state, setGraphData({
      repoId: 'repo-2',
      graphData: {
        nodes: [{ id: 'function:src/index.js#greet', name: 'greet', type: 'FUNCTION', file: 'src/index.js' }],
        edges: [],
      },
    }));

    state = reducer(state, setSelectedNode({
      id: 'function:src/index.js#greet',
      graphData: state.graphData,
    }));

    state = reducer(state, applyGraphPatch({
      repoId: 'repo-2',
      patch: {
        graphData: {
          nodes: [],
          edges: [],
        },
        removedNodeIds: ['function:src/index.js#greet'],
      },
    }));

    expect(state.selectedNode).toBeNull();
    expect(state.directImpact).toEqual([]);
    expect(state.transitiveImpact).toEqual([]);
  });
});
