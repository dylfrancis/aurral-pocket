require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'Tailscale'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = package['license']
  s.author         = package['author']
  s.homepage       = package['homepage']
  s.platforms      = {
    :ios => '16.4'
  }
  s.swift_version  = '5.4'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Built from gateway/ by scripts/build-tailscale-gateway.sh, and git-ignored.
  # Without it the module compiles and reports Tailscale unavailable.
  if File.exist?(File.join(__dir__, 'Gateway.xcframework'))
    s.vendored_frameworks = 'Gateway.xcframework'
    s.libraries = 'resolv'
  end

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  # Top level only, so the framework's own headers stay out of the pod.
  s.source_files = "*.swift"
end
