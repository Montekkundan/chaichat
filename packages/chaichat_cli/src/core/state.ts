export interface GlobalState {
    name: string;
    apiKey: string;
  }
  
  let globalState: GlobalState = {
    name: "",
    apiKey: "",
  };
  
  export function getGlobalState(): GlobalState {
    return globalState;
  }
  
  export function setGlobalState(updates: Partial<GlobalState>): void {
    globalState = { ...globalState, ...updates };
  }
  
  export function resetGlobalState(): void {
    globalState = { name: "", apiKey: "" };
  }
  
  