// worker.d.ts
declare module "*.worker.ts" {
    class WebWorker extends Worker {
        constructor();
    }

    export default WebWorker;
}

// Import with query parameter
declare module "*.worker.ts?worker" {
    class WebWorker extends Worker {
        constructor();
    }

    export default WebWorker;
}