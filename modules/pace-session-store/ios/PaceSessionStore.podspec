# The Keychain-backed session store PaceTasks shares between the app (supabase-js)
# and its Siri App Intents, plus the client those intents use to reach the server.
Pod::Spec.new do |s|
  s.name           = 'PaceSessionStore'
  s.version        = '1.0.0'
  s.summary        = 'PaceTasks session store and Siri client'
  s.description    = 'Keeps the Supabase session in the Keychain so Siri can act for the signed-in user.'
  s.author         = 'PaceTasks'
  s.homepage       = 'https://bilgaaaaa.github.io/pacetasks'
  s.license        = { :type => 'Proprietary' }
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = '**/*.swift'
end
