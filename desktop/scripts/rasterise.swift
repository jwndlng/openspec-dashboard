// Rasterises SVGs to PNGs with AppKit, keeping transparency (qlmanage paints a white ground, which a menu bar
// template image cannot have). Arguments: triples of `<svg> <png> <size>`, where the size is `<pixels>` for a square
// or `<width>x<height>`.
import AppKit

/** `128` or `640x400` as a pixel width and height. */
func pixels(_ size: String) -> (Int, Int)? {
  let parts = size.split(separator: "x", omittingEmptySubsequences: false).map { Int($0) }
  if parts.count == 1, let side = parts[0], side > 0 { return (side, side) }
  if parts.count == 2, let width = parts[0], let height = parts[1], width > 0, height > 0 { return (width, height) }
  return nil
}

let args = Array(CommandLine.arguments.dropFirst())
guard args.count % 3 == 0, !args.isEmpty else {
  FileHandle.standardError.write("usage: rasterise.swift (<svg> <png> <pixels>|<width>x<height>)...\n".data(using: .utf8)!)
  exit(2)
}
for i in stride(from: 0, to: args.count, by: 3) {
  guard let image = NSImage(contentsOfFile: args[i]), let (width, height) = pixels(args[i + 2]),
    let rep = NSBitmapImageRep(
      bitmapDataPlanes: nil, pixelsWide: width, pixelsHigh: height, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true,
      isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)
  else {
    FileHandle.standardError.write("cannot rasterise \(args[i])\n".data(using: .utf8)!)
    exit(1)
  }
  NSGraphicsContext.saveGraphicsState()
  NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
  image.draw(in: NSRect(x: 0, y: 0, width: width, height: height))
  NSGraphicsContext.restoreGraphicsState()
  guard let png = rep.representation(using: .png, properties: [:]) else { exit(1) }
  try png.write(to: URL(fileURLWithPath: args[i + 1]))
}
