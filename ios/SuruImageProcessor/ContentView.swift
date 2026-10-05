import SwiftUI

struct ContentView: View {
    @StateObject private var worker = ProcessorViewModel()

    var body: some View {
        NavigationStack {
            VStack(spacing: 18) {
                Image(systemName: "wand.and.stars").font(.system(size: 48))
                Text("Suru Image Processor").font(.title2.bold())
                Text(worker.status).multilineTextAlignment(.center).foregroundStyle(.secondary)
                Button(worker.isRunning ? "Stop Processing" : "Start Processing") {
                    worker.isRunning ? worker.stop() : worker.start()
                }
                .buttonStyle(.borderedProminent)
                if worker.processed > 0 { Text("\(worker.processed) image(s) processed") }
                Text("Originals remain untouched in Google Drive.").font(.footnote).foregroundStyle(.secondary)
            }.padding(24).navigationTitle("Suru Processor")
        }
    }
}

@MainActor
final class ProcessorViewModel: ObservableObject {
    @Published var isRunning = false
    @Published var processed = 0
    @Published var status = "Ready"
    private var task: Task<Void, Never>?

    func start() {
        guard task == nil else { return }
        isRunning = true
        status = "Waiting for an image job…"
        task = Task { await runLoop() }
    }

    func stop() {
        task?.cancel()
        task = nil
        isRunning = false
        status = "Stopped"
    }

    private func runLoop() async {
        defer { task = nil; isRunning = false }
        while !Task.isCancelled {
            do {
                guard let job = try await SupabaseWorkerClient.shared.claim() else {
                    status = "Queue is empty"
                    try? await Task.sleep(for: .seconds(15))
                    continue
                }
                status = "Processing \(job.productCode)…"
                let source = try await SupabaseWorkerClient.shared.downloadSource(job.sourceURL)
                let result = try await ImagePipeline.shared.process(source)
                status = "Uploading \(job.productCode)…"
                try await SupabaseWorkerClient.shared.complete(job: job, imageData: result)
                processed += 1
                status = "Completed \(job.productCode)"
            } catch is CancellationError { break }
            catch {
                status = "Job error: \(error.localizedDescription)"
                try? await Task.sleep(for: .seconds(5))
            }
        }
    }
}
