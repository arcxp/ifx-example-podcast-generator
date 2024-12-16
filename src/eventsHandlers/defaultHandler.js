const defaultHandler = (event) => {
    // Customer logic
    console.log(`my default logic`);
  
    return { "status": "event processed correctly" }
  }
  
  module.exports = defaultHandler;