// Rasterises SVGs to PNGs with AppKit, keeping transparency (qlmanage paints a white ground, which a menu bar
// template image cannot have). Arguments: triples of `<svg> <png> <pixels>`.
import AppKit

let args = Array(CommandLine.arguments.dropFirst())
guard args.count % 3 == 0, !args.isEmpty else {
  FileHandle.standardError.write("usage: rasterise.swift (<svg> <png> <pixels>)...\n".data(using: .utf8)!)
  exit(2)
}
for i in stride(from: 0, to: args.count, by: 3) {
  guard let image = NSImage(contentsOfFile: args[i]), let size = Int(args[i + 2]),
    let rep = NSBitmapImageRep(
      bitmapDataPlanes: nil, pixelsWide: size, pixelsHigh: size, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true,
      isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)
  else {
    FileHandle.standardError.write("cannot rasterise \(args[i])\n".data(using: .utf8)!)
    exit(1)
  }
  NSGraphicsContext.saveGraphicsState()
  NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
  image.draw(in: NSRect(x: 0, y: 0, width: size, height: size))
  NSGraphicsContext.restoreGraphicsState()
  guard let png = rep.representation(using: .png, properties: [:]) else { exit(1) }
  try png.write(to: URL(fileURLWithPath: args[i + 1]))
}
