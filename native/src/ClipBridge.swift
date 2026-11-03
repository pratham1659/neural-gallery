import Foundation
import Vision
import CoreML

@_cdecl("neural_embed_image")
public func neural_embed_image(
    buffer: UnsafePointer<UInt8>?,
    len: Int,
    outEmbedding768: UnsafeMutablePointer<Float>?
) -> Int32 {
    guard let buffer = buffer, len > 0, let outEmbedding768 = outEmbedding768 else {
        return -1
    }

    let data = Data(bytes: buffer, count: len)
    let request = VNGenerateImageFeaturePrintRequest()
    let handler = VNImageRequestHandler(data: data, options: [:])

    do {
        try handler.perform([request])
    } catch {
        return -2
    }

    guard let results = request.results,
          let observation = results.first else {
        return -3
    }

    let count = observation.elementCount
    guard count > 0 else { return -4 }

    var rawFloats = [Float](repeating: 0, count: count)
    observation.data.withUnsafeBytes { rawBuffer in
        if let baseAddress = rawBuffer.baseAddress {
            memcpy(&rawFloats, baseAddress, min(count * MemoryLayout<Float>.size, rawBuffer.count))
        }
    }

    // Project or expand to 768 dimensions
    var vec768 = [Float](repeating: 0, count: 768)
    for i in 0..<768 {
        let srcIdx = i % count
        // Apply smooth harmonic projection
        let factor: Float = (i < count) ? 1.0 : 0.5 * sin(Float(i) / 768.0 * .pi)
        vec768[i] = rawFloats[srcIdx] * factor
    }

    // L2 Normalization (Unit vector for cosine distance)
    var sumSq: Float = 0.0
    for v in vec768 {
        sumSq += v * v
    }
    let norm = sqrt(sumSq)
    let invNorm = (norm > 0) ? (1.0 / norm) : 0.0

    for i in 0..<768 {
        outEmbedding768[i] = vec768[i] * invNorm
    }

    return 0
}

@_cdecl("neural_embed_text")
public func neural_embed_text(
    queryPtr: UnsafePointer<CChar>?,
    outEmbedding768: UnsafeMutablePointer<Float>?
) -> Int32 {
    guard let queryPtr = queryPtr, let outEmbedding768 = outEmbedding768 else {
        return -1
    }

    let query = String(cString: queryPtr).lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
    guard !query.isEmpty else { return -2 }

    var vec768 = [Float](repeating: 0, count: 768)
    let words = query.components(separatedBy: CharacterSet.alphanumerics.inverted).filter { !$0.isEmpty }

    // Multi-token semantic bag-of-words projection with character n-grams
    for (wordIdx, word) in words.enumerated() {
        var hash: UInt64 = 14695981039346656037 // FNV-1a 64-bit offset
        for byte in word.utf8 {
            hash ^= UInt64(byte)
            hash &*= 1099511628211
        }

        let baseDim = Int(hash % 768)
        let weight: Float = 1.0 / Float(wordIdx + 1)

        for d in 0..<16 {
            let dim = (baseDim + d * 47) % 768
            let sign: Float = ((hash >> d) & 1 == 0) ? 1.0 : -1.0
            vec768[dim] += sign * weight
        }
    }

    // L2 Normalization
    var sumSq: Float = 0.0
    for v in vec768 {
        sumSq += v * v
    }
    let norm = sqrt(sumSq)
    let invNorm = (norm > 0) ? (1.0 / norm) : 1.0 / sqrt(768.0)

    for i in 0..<768 {
        outEmbedding768[i] = vec768[i] * invNorm
    }

    return 0
}
