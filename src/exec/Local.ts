class LocalExecutor implements Executor {
  constructor(private fn:SparksFunction) {
  }

  async exec(message:any, context:ClientContext) {
    return []
  }
}