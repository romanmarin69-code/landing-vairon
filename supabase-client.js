(() => {
  const projectUrl = "https://esrwshmtjzldzkbtmkrt.supabase.co";
  const publishableKey = "sb_publishable_DKvWQGko6f7gbGoJ0A_yCw_YaoWfwOA";
  const bucketName = "vehicle-photos";
  let client;

  function getClient() {
    if (!client) {
      if (!window.supabase?.createClient) {
        throw new Error("No se pudo cargar el servicio de base de datos.");
      }

      client = window.supabase.createClient(projectUrl, publishableKey);
    }

    return client;
  }

  function throwIfError(error) {
    if (!error) return;

    if (error.code === "PGRST205" || error.code === "42P01") {
      throw new Error("Falta preparar la base de datos. Ejecutá supabase/setup.sql en Supabase.");
    }

    throw new Error(error.message || "Ocurrió un error al comunicarse con la base de datos.");
  }

  async function getAdminProfile() {
    const supabase = getClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    throwIfError(userError);

    if (!userData.user) return null;

    const { data, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .maybeSingle();
    throwIfError(error);

    return data?.role === "admin" ? userData.user : null;
  }

  async function loadVehicles(publicOnly) {
    const supabase = getClient();
    let query = supabase.from("vehicles").select("*").order("created_at", { ascending: false });

    if (publicOnly) {
      query = query.eq("publicado", true).eq("estado", "ACTIVO");
    }

    const { data, error } = await query;
    throwIfError(error);
    return data || [];
  }

  async function requireAdmin() {
    if (!(await getAdminProfile())) {
      throw new Error("La sesión no tiene permiso de administrador.");
    }
  }

  async function uploadPhoto(photo, vehicleId) {
    if (!photo.startsWith("data:image/")) return photo;

    const response = await fetch(photo);
    if (!response.ok) throw new Error("No se pudo leer una de las fotos seleccionadas.");

    const file = await response.blob();
    const subtype = file.type.split("/")[1] || "jpg";
    const extension = subtype === "jpeg" ? "jpg" : subtype.replace("svg+xml", "svg");
    const path = `${vehicleId}/${crypto.randomUUID()}.${extension}`;
    const supabase = getClient();
    const { error } = await supabase.storage
      .from(bucketName)
      .upload(path, file, { contentType: file.type, cacheControl: "3600" });
    throwIfError(error);

    const { data } = supabase.storage.from(bucketName).getPublicUrl(path);
    return data.publicUrl;
  }

  async function initialize() {
    const supabase = getClient();
    const { data, error } = await supabase.auth.getSession();
    throwIfError(error);

    if (data.session) {
      const user = await getAdminProfile();
      if (user) {
        return { vehicles: await loadVehicles(false), isAdmin: true };
      }

      const { error: signOutError } = await supabase.auth.signOut();
      throwIfError(signOutError);
    }

    return { vehicles: await loadVehicles(true), isAdmin: false };
  }

  async function signIn(email, password) {
    const supabase = getClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    throwIfError(error);

    if (!(await getAdminProfile())) {
      const { error: signOutError } = await supabase.auth.signOut();
      throwIfError(signOutError);
      throw new Error("Esta cuenta no tiene acceso de administrador.");
    }

    return loadVehicles(false);
  }

  async function signOut() {
    const { error } = await getClient().auth.signOut();
    throwIfError(error);
  }

  async function saveVehicle(vehicle) {
    await requireAdmin();

    const photos = [];
    for (const photo of vehicle.photos || []) {
      photos.push(await uploadPhoto(photo, vehicle.id));
    }

    const row = {
      id: vehicle.id,
      slug: vehicle.slug,
      marca: vehicle.marca,
      modelo: vehicle.modelo,
      version: vehicle.version || "",
      anio: vehicle.anio,
      km: vehicle.km || 0,
      precio: vehicle.precio,
      moneda: vehicle.moneda || "ARS",
      color: vehicle.color || "",
      motor: vehicle.motor || "",
      combustible: vehicle.combustible || "Nafta",
      transmision: vehicle.transmision || "Automática",
      cilindrada: vehicle.cilindrada || "",
      traccion: vehicle.traccion || "",
      descripcion: vehicle.descripcion || "",
      equipamiento: vehicle.equipamiento || [],
      destacadas: vehicle.destacadas || "",
      info: vehicle.info || "",
      photos,
      estado: vehicle.estado || "ACTIVO",
      publicado: Boolean(vehicle.publicado),
      fecha: vehicle.fecha,
    };

    const { data, error } = await getClient()
      .from("vehicles")
      .upsert(row)
      .select()
      .single();
    throwIfError(error);
    return data;
  }

  async function deleteVehicle(id) {
    await requireAdmin();

    const { error } = await getClient().from("vehicles").delete().eq("id", id);
    throwIfError(error);
  }

  window.VaironData = {
    initialize,
    loadPublic: () => loadVehicles(true),
    loadAdmin: async () => {
      await requireAdmin();
      return loadVehicles(false);
    },
    signIn,
    signOut,
    saveVehicle,
    deleteVehicle,
  };
})();
