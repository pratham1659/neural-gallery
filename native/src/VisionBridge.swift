import Foundation
import Vision
import CoreGraphics

@_cdecl("neural_detect_faces")
public func neural_detect_faces(
    buffer: UnsafePointer<UInt8>?,
    len: Int,
    outBoxes: UnsafeMutablePointer<Float>?,
    maxBoxes: Int32
) -> Int32 {
    guard let buffer = buffer, len > 0, let outBoxes = outBoxes, maxBoxes > 0 else {
        return -1
    }

    let data = Data(bytes: buffer, count: len)
    let request = VNDetectFaceRectanglesRequest()
    if #available(macOS 12.0, *) {
        request.revision = VNDetectFaceRectanglesRequestRevision3
    }
    let handler = VNImageRequestHandler(data: data, options: [:])

    do {
        try handler.perform([request])
    } catch {
        return -2
    }

    guard let results = request.results else {
        return 0
    }

    let count = min(Int(maxBoxes), results.count)
    for i in 0..<count {
        let face = results[i]
        let box = face.boundingBox
        let conf = face.confidence
        let offset = i * 5
        outBoxes[offset + 0] = Float(box.origin.x)
        outBoxes[offset + 1] = Float(box.origin.y)
        outBoxes[offset + 2] = Float(box.size.width)
        outBoxes[offset + 3] = Float(box.size.height)
        outBoxes[offset + 4] = conf
    }

    return Int32(count)
}

@_cdecl("neural_detect_animals")
public func neural_detect_animals(
    buffer: UnsafePointer<UInt8>?,
    len: Int,
    outBoxes: UnsafeMutablePointer<Float>?,
    outLabels: UnsafeMutablePointer<CChar>?,
    maxBoxes: Int32
) -> Int32 {
    guard let buffer = buffer, len > 0, let outBoxes = outBoxes, maxBoxes > 0 else {
        return -1
    }

    let data = Data(bytes: buffer, count: len)
    let request = VNRecognizeAnimalsRequest()
    let handler = VNImageRequestHandler(data: data, options: [:])

    do {
        try handler.perform([request])
    } catch {
        return -2
    }

    guard let results = request.results else {
        return 0
    }

    let count = min(Int(maxBoxes), results.count)
    for i in 0..<count {
        let animal = results[i]
        let box = animal.boundingBox
        let conf = animal.confidence
        let offset = i * 5
        outBoxes[offset + 0] = Float(box.origin.x)
        outBoxes[offset + 1] = Float(box.origin.y)
        outBoxes[offset + 2] = Float(box.size.width)
        outBoxes[offset + 3] = Float(box.size.height)
        outBoxes[offset + 4] = conf

        if let outLabels = outLabels {
            var labelStr = "pet"
            if let topLabel = animal.labels.first?.identifier.lowercased() {
                if topLabel.contains("dog") {
                    labelStr = "dog"
                } else if topLabel.contains("cat") {
                    labelStr = "cat"
                } else {
                    labelStr = topLabel
                }
            }
            let labelOffset = i * 32
            let utf8 = Array(labelStr.utf8.prefix(31))
            for bIdx in 0..<utf8.count {
                outLabels[labelOffset + bIdx] = CChar(bitPattern: utf8[bIdx])
            }
            outLabels[labelOffset + utf8.count] = 0
        }
    }

    return Int32(count)
}

@_cdecl("neural_extract_ocr")
public func neural_extract_ocr(
    buffer: UnsafePointer<UInt8>?,
    len: Int,
    outText: UnsafeMutablePointer<CChar>?,
    maxLen: Int
) -> Int32 {
    guard let buffer = buffer, len > 0, let outText = outText, maxLen > 1 else {
        return -1
    }

    let data = Data(bytes: buffer, count: len)
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true

    let handler = VNImageRequestHandler(data: data, options: [:])

    do {
        try handler.perform([request])
    } catch {
        return -2
    }

    guard let observations = request.results else {
        outText[0] = 0
        return 0
    }

    var recognized: [String] = []
    for obs in observations {
        if let topCandidate = obs.topCandidates(1).first {
            recognized.append(topCandidate.string)
        }
    }

    let fullText = recognized.joined(separator: " ")
    let utf8 = Array(fullText.utf8)
    let copyLen = min(maxLen - 1, utf8.count)

    for i in 0..<copyLen {
        outText[i] = CChar(bitPattern: utf8[i])
    }
    outText[copyLen] = 0

    return Int32(copyLen)
}
