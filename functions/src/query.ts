const ALLOWED_PARAMS = new Set([
  'keyword',
  'latlong',
  'city',
  'stateCode',
  'radius',
  'unit',
  'startDateTime',
  'endDateTime',
  'classificationName',
  'page',
])

const CATEGORIES = new Set(['Music', 'Sports', 'Arts & Theatre', 'Film', 'Miscellaneous'])
const RADII = new Set(['5', '10', '25', '50'])

export function sanitizeParams(incoming: URLSearchParams): URLSearchParams {
  const params = new URLSearchParams()
  for (const [key, value] of incoming) {
    if (!ALLOWED_PARAMS.has(key) || !value.trim()) continue
    params.append(key, value.trim())
  }

  const keyword = params.get('keyword')
  if (keyword && keyword.length > 80) params.set('keyword', keyword.slice(0, 80))

  const city = params.get('city')
  if (city && city.length > 80) params.set('city', city.slice(0, 80))

  const stateCode = params.get('stateCode')
  if (stateCode && !/^[a-z]{2}$/i.test(stateCode)) params.delete('stateCode')
  else if (stateCode) params.set('stateCode', stateCode.toUpperCase())

  const latlong = params.get('latlong')
  if (latlong && !/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(latlong)) params.delete('latlong')

  const radius = params.get('radius')
  if (radius && !RADII.has(radius)) params.delete('radius')
  if (!params.has('latlong')) params.delete('radius')

  if (params.has('unit')) params.set('unit', 'miles')

  const category = params.get('classificationName')
  if (category && !CATEGORIES.has(category)) params.delete('classificationName')

  const page = params.get('page')
  if (page != null && !/^\d+$/.test(page)) params.delete('page')

  params.set('size', '20')
  params.set('sort', 'date,asc')
  return params
}
