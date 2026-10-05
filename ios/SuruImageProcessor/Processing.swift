import Foundation
import UIKit

struct ProcessingJob: Codable {
    let id: String
    let productCode: String
    let sourceFileID: String
    let sourceFileName: String?
    let sourceURL: URL
    enum CodingKeys: String, CodingKey { case id; case productCode = "product_code"; case sourceFileID = "source_file_id"; case sourceFileName = "source_file_name"; case sourceURL = "source_url" }
}

struct ClaimResponse: Codable { let success: Bool; let job: ProcessingJob? }
struct CompleteResponse: Codable { let success: Bool }

enum WorkerError: LocalizedError {
    case http
    case notConfigured
    var errorDescription: String? { switch self { case .http: return "Suru worker request failed."; case .notConfigured: return "Supabase Auth is not configured yet." } }
}

final class SupabaseAuth {
    static let shared = SupabaseAuth()
    private init() {}
    func accessToken() async throws -> String { throw WorkerError.notConfigured }
}

final class SupabaseWorkerClient {
    static let shared = SupabaseWorkerClient()
    private let workerURL = URL(string: "https://vkycraymxhkqxgpcpdzw.supabase.co/functions/v1/google-drive-image-worker")!
    private init() {}

    func claim() async throws -> ProcessingJob? {
        var r = URLRequest(url: workerURL)
        r.httpMethod = "POST"
        r.setValue("application/json", forHTTPHeaderField: "Content-Type")
        r.setValue("Bearer \(try await SupabaseAuth.shared.accessToken())", forHTTPHeaderField: "Authorization")
        r.httpBody = Data(#"{"action":"claim"}"#.utf8)
        let (data, response) = try await URLSession.shared.data(for: r)
        try validate(response)
        return try JSONDecoder().decode(ClaimResponse.self, from: data).job
    }

    func downloadSource(_ url: URL) async throws -> Data {
        let (data, response) = try await URLSession.shared.data(from: url)
        try validate(response)
        return data
    }

    func complete(job: ProcessingJob, imageData: Data) async throws {
        var r = URLRequest(url: workerURL)
        r.httpMethod = "POST"
        r.setValue("Bearer \(try await SupabaseAuth.shared.accessToken())", forHTTPHeaderField: "Authorization")
        let boundary = "Suru-\(UUID().uuidString)"
        r.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        let filename = "processed-\(job.sourceFileName ?? job.sourceFileID).jpg"
        var b = Data()
        b.append(Data("--\(boundary)\r\nContent-Disposition: form-data; name=\"action\"\r\n\r\ncomplete\r\n".utf8))
        b.append(Data("--\(boundary)\r\nContent-Disposition: form-data; name=\"job_id\"\r\n\r\n\(job.id)\r\n".utf8))
        b.append(Data("--\(boundary)\r\nContent-Disposition: form-data; name=\"file_name\"\r\n\r\n\(filename)\r\n".utf8))
        b.append(Data("--\(boundary)\r\nContent-Disposition: form-data; name=\"file\"; filename=\"\(filename)\"\r\nContent-Type: image/jpeg\r\n\r\n".utf8))
        b.append(imageData)
        b.append(Data("\r\n--\(boundary)--\r\n".utf8))
        r.httpBody = b
        let (data, response) = try await URLSession.shared.data(for: r)
        try validate(response)
        _ = try JSONDecoder().decode(CompleteResponse.self, from: data)
    }

    private func validate(_ response: URLResponse) throws {
        guard let h = response as? HTTPURLResponse, (200..<300).contains(h.statusCode) else { throw WorkerError.http }
    }
}

final class ImagePipeline {
    static let shared = ImagePipeline()
    private init() {}

    func process(_ source: Data) async throws -> Data {
        // Temporary smoke-test path. Replace this with the verified Moebius
        // Core AI pipeline before enabling automatic production processing.
        guard let image = UIImage(data: source), let data = image.jpegData(compressionQuality: 0.92) else { throw WorkerError.http }
        return data
    }
}
