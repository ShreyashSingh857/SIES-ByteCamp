import neo4j from 'neo4j-driver';

const neo4jUri = process.env.NEO4J_URI;
const neo4jUser = process.env.NEO4J_USER || process.env.NEO4J_USERNAME;
const neo4jPassword = process.env.NEO4J_PASSWORD;

const isNeo4jConfigured = Boolean(neo4jUri && neo4jUser && neo4jPassword);

const driver = isNeo4jConfigured
  ? neo4j.driver(
      neo4jUri,
      neo4j.auth.basic(neo4jUser, neo4jPassword)
    )
  : null;

function getConfigError() {
  return new Error(
    'Neo4j is not configured. Set NEO4J_URI, NEO4J_USER (or NEO4J_USERNAME), and NEO4J_PASSWORD in environment variables.'
  );
}

export const getSession = () => {
  if (!driver) {
    throw getConfigError();
  }
  return driver.session();
};

export const verifyNeo4jConnectivity = async () => {
  if (!driver) {
    return { configured: false };
  }
  await driver.verifyConnectivity();
  return { configured: true };
};

export { isNeo4jConfigured };
export default driver;
