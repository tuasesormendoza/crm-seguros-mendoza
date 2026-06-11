/** Friendly "you can't be here" message shown to roles without access to a section. */
export default function AccessDenied() {
  return (
    <div className="max-w-md mx-auto mt-20 text-center bg-white rounded-2xl border border-gray-200 p-8">
      <div className="text-5xl mb-4">🔒</div>
      <h1 className="text-xl font-bold mb-2" style={{ color: '#10253f' }}>Acceso no autorizado</h1>
      <p className="text-sm text-gray-500">
        No tienes permisos para acceder a esta sección. Contacta a tu administrador si necesitas realizar cambios aquí.
      </p>
    </div>
  )
}
