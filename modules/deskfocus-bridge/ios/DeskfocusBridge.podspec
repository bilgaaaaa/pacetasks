# Local Expo module, autolinked from modules/; the work itself is in targets/deskfocus/_shared/DeskfocusBridgeHandler.swift.
Pod::Spec.new do |s|
  s.name           = 'DeskfocusBridge'
  s.version        = '1.0.0'
  s.summary        = "Lets PaceTasks' JavaScript drive the DeskFocus focus session shared with the widget"
  s.author         = 'PaceTasks'
  s.homepage       = 'https://github.com/bilgaaaaa/pacetasks'
  s.license        = { :type => 'Proprietary' }
  s.platforms      = { :ios => '17.0' }
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = '**/*.swift'
end
